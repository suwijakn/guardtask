import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lineClient } from "@/lib/line";
import bcrypt from "bcryptjs";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]
    : req.headers.get("x-real-ip") || "unknown";
  return ip;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRateLimitKey(req);

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 1 minute." },
        { status: 429 },
      );
    }

    // Support both query params and body
    const { searchParams } = new URL(req.url);
    let password = searchParams.get("password");
    let lineUserId = searchParams.get("lineUserId");

    // If not in query params, try body
    if (!password || !lineUserId) {
      try {
        const body = await req.json();
        password = password || body.password;
        lineUserId = lineUserId || body.lineUserId;
      } catch (e) {
        // Body parsing failed, continue with query params
      }
    }

    if (!password || !lineUserId) {
      return NextResponse.json(
        {
          error:
            "password and lineUserId are required (in body or query params)",
        },
        { status: 400 },
      );
    }

    const sites = await db.site.findMany({
      where: {
        isActive: true,
        checkinPasswordHash: { not: null },
      },
      include: {
        guardSiteAssignments: {
          include: {
            guard: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    for (const site of sites) {
      if (!site.checkinPasswordHash) continue;

      const isMatch = await bcrypt.compare(password, site.checkinPasswordHash);

      if (isMatch) {
        const guards = site.guardSiteAssignments.map((assignment) => ({
          id: assignment.guard.id,
          name: assignment.guard.fullName,
          employee_code: assignment.guard.employeeCode,
        }));

        // Fetch LINE profile
        let displayName = "Unknown";
        if (lineClient) {
          try {
            const profile = await lineClient.getProfile(lineUserId);
            displayName = profile.displayName;
          } catch (e) {
            console.error("Failed to fetch LINE profile:", e);
          }
        }

        // Create or update LINE mapping (pending verification)
        await db.lineMapping.upsert({
          where: { lineUserId },
          create: {
            lineUserId,
            displayName,
            siteId: site.id,
            mappingMethod: "auto_checkin",
            isVerified: false,
          },
          update: {
            displayName,
            siteId: site.id,
            mappingMethod: "auto_checkin",
          },
        });

        return NextResponse.json({
          site_id: site.id,
          site_name: site.name,
          guards,
        });
      }
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    console.error("Error in /api/checkin/verify-site-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
