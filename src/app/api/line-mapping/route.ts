import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const mappings = await db.lineMapping.findMany({
      include: {
        guard: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ isVerified: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Error fetching line mappings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
