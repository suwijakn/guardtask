import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sites = await db.site.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        isActive: true,
        checkinPasswordHash: true,
        passwordUpdatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("Error fetching sites:", error);
    return NextResponse.json(
      { error: "Failed to fetch sites" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  // TODO: Implement site creation
  return Response.json({ ok: true });
}
