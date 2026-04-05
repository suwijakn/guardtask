import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const guards = await db.guard.findMany({
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        employmentStatus: true,
        currentSite: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({ guards });
  } catch (error) {
    console.error("Error fetching guards:", error);
    return NextResponse.json(
      { error: "Failed to fetch guards" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  // TODO: Implement guard creation
  return Response.json({ ok: true });
}
