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

interface CheckoutRequest {
  checkinId: string;
  photo: string; // base64
  lineUserId: string;
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

    const body: CheckoutRequest = await req.json();
    const { checkinId, photo, lineUserId } = body;

    // Validate required fields
    if (!checkinId || !photo || !lineUserId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Find the checkin record
    const checkin = await db.shiftCheckin.findUnique({
      where: { id: checkinId },
    });

    if (!checkin) {
      return NextResponse.json(
        { error: "Check-in record not found" },
        { status: 404 },
      );
    }

    if (checkin.checkoutAt) {
      return NextResponse.json(
        { error: "Already checked out" },
        { status: 400 },
      );
    }

    // Upload checkout photo to Supabase Storage
    const photoBuffer = Buffer.from(photo.split(",")[1], "base64");
    const fileName = `checkout_${checkin.guardId}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
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

    // Update checkin record with checkout info
    const updated = await db.shiftCheckin.update({
      where: { id: checkinId },
      data: {
        checkoutAt: new Date(),
        checkoutPhotoUrl: publicUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      checkoutId: updated.id,
      checkinAt: updated.checkinAt,
      checkoutAt: updated.checkoutAt,
    });
  } catch (error) {
    console.error("Check-out error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
