import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

interface CheckinRequest {
  guardId: string;
  siteId: string;
  photo: string; // base64
  lineUserId: string;
  pathType: "A" | "B";
  lat?: number;
  lng?: number;
}

function calculateShiftType(hour: number): "day" | "night" {
  // Day: 6:00-18:00, Night: 18:00-6:00
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function calculateStatus(lateMinutes: number): string {
  if (lateMinutes <= 0) return "on_time";
  if (lateMinutes <= 15) return "late_minor";
  return "late_major";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL",
        },
        { status: 500 },
      );
    }

    const body: CheckinRequest = await req.json();
    const { guardId, siteId, photo, lineUserId, pathType, lat, lng } = body;

    // Validate required fields
    if (!guardId || !siteId || !photo || !lineUserId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate guard is active and assigned to site
    const guard = await db.guard.findUnique({
      where: { id: guardId },
      include: {
        guardSiteAssignments: {
          where: { siteId },
        },
      },
    });

    if (!guard) {
      return NextResponse.json({ error: "Guard not found" }, { status: 404 });
    }

    if (guard.employmentStatus !== "active") {
      return NextResponse.json(
        { error: "Guard is not active" },
        { status: 400 },
      );
    }

    if (guard.guardSiteAssignments.length === 0) {
      return NextResponse.json(
        { error: "Guard is not assigned to this site" },
        { status: 400 },
      );
    }

    // Get site info for shift times
    const site = await db.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Upload photo to Supabase Storage
    const photoBuffer = Buffer.from(photo.split(",")[1], "base64");
    const fileName = `${guardId}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("checkin-photos")
      .upload(fileName, photoBuffer, {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error("Photo upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload photo" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("checkin-photos").getPublicUrl(fileName);

    // Calculate shift details
    const now = new Date();
    const hour = now.getHours();
    const shiftType = calculateShiftType(hour);

    // Calculate late minutes based on shift start time
    const shiftStartTime =
      shiftType === "day" ? site.shiftStartDay : site.shiftStartNight;

    const [startHour, startMinute] = shiftStartTime.split(":").map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(startHour, startMinute, 0, 0);

    const lateMinutes = Math.max(
      0,
      Math.floor((now.getTime() - shiftStart.getTime()) / 60000),
    );
    const status = calculateStatus(lateMinutes);

    // Check within site geofence
    let checkinWithinSite = null;
    if (lat && lng && site.lat && site.lng) {
      const distance = calculateDistance(
        Number(site.lat),
        Number(site.lng),
        lat,
        lng,
      );
      checkinWithinSite = distance <= site.geofenceRadiusM;
    }

    // Get consecutive shifts data
    const recentCheckins = await db.shiftCheckin.findMany({
      where: {
        guardId,
        checkinAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { checkinAt: "desc" },
      take: 10,
    });

    const consecutiveShifts = calculateConsecutiveShifts(recentCheckins);
    const consecutiveHours = calculateConsecutiveHours(recentCheckins);
    const isDoubleShift = checkDoubleShift(recentCheckins, now);

    // Create shift checkin record
    const checkin = await db.shiftCheckin.create({
      data: {
        guardId,
        siteId,
        checkinAt: now,
        checkinPhotoUrl: publicUrl,
        checkinLat: lat ? String(lat) : null,
        checkinLng: lng ? String(lng) : null,
        checkinWithinSite,
        shiftType,
        status,
        lateMinutes,
        consecutiveShifts,
        consecutiveHours,
        isDoubleShift,
      },
    });

    // If Path B, ensure LINE mapping exists (already created in verify-site-password)
    // No additional action needed here

    return NextResponse.json({
      ok: true,
      checkinId: checkin.id,
      status,
      lateMinutes,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper: Calculate consecutive shifts
function calculateConsecutiveShifts(recentCheckins: any[]): number {
  if (recentCheckins.length === 0) return 1;

  let consecutive = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < recentCheckins.length; i++) {
    const checkinDate = new Date(recentCheckins[i].checkinAt);
    checkinDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - checkinDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysDiff === i + 1) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

// Helper: Calculate consecutive hours
function calculateConsecutiveHours(recentCheckins: any[]): number {
  if (recentCheckins.length === 0) return 0;

  let totalHours = 0;
  for (const checkin of recentCheckins) {
    if (checkin.checkoutAt) {
      const hours =
        (new Date(checkin.checkoutAt).getTime() -
          new Date(checkin.checkinAt).getTime()) /
        (60 * 60 * 1000);
      totalHours += hours;
    }
  }

  return Math.floor(totalHours);
}

// Helper: Check if this is a double shift (2 shifts in same day)
function checkDoubleShift(recentCheckins: any[], currentTime: Date): boolean {
  const today = new Date(currentTime);
  today.setHours(0, 0, 0, 0);

  const todayCheckins = recentCheckins.filter((c) => {
    const checkinDate = new Date(c.checkinAt);
    checkinDate.setHours(0, 0, 0, 0);
    return checkinDate.getTime() === today.getTime();
  });

  return todayCheckins.length >= 1;
}
