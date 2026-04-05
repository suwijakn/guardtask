import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { guardId } = body;

    if (!guardId) {
      return NextResponse.json(
        { error: "guardId is required" },
        { status: 400 },
      );
    }

    const mapping = await db.lineMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    // Verify guard exists
    const guard = await db.guard.findUnique({
      where: { id: guardId },
    });

    if (!guard) {
      return NextResponse.json({ error: "Guard not found" }, { status: 404 });
    }

    const updated = await db.lineMapping.update({
      where: { id },
      data: { guardId },
      include: {
        guard: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      mapping: updated,
    });
  } catch (error) {
    console.error("Error updating line mapping:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const mapping = await db.lineMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    await db.lineMapping.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Mapping deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting line mapping:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
