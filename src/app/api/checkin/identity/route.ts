import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { status: "no_line_id", error: "lineUserId parameter is required" },
        { status: 400 },
      );
    }

    const mapping = await db.lineMapping.findUnique({
      where: { lineUserId },
      include: {
        guard: {
          include: {
            guardSiteAssignments: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });

    if (!mapping || !mapping.isVerified) {
      return NextResponse.json({ status: "unverified" });
    }

    if (!mapping.guard) {
      return NextResponse.json({ status: "unverified" });
    }

    return NextResponse.json({
      status: "verified",
      guard_id: mapping.guardId,
      guard_name: mapping.guard.fullName,
      sites: mapping.guard.guardSiteAssignments.map((a) => ({
        id: a.siteId,
        name: a.site.name,
        is_primary: a.isPrimary,
      })),
    });
  } catch (error) {
    console.error("Error in /api/checkin/identity:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 },
    );
  }
}
