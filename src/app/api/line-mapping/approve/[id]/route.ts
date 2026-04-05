import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lineClient } from "@/lib/line";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { guardId } = body;

    const mapping = await db.lineMapping.findUnique({
      where: { id },
      include: {
        guard: true,
      },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    if (mapping.isVerified) {
      return NextResponse.json(
        { error: "Mapping already verified" },
        { status: 400 },
      );
    }

    // Require guardId for approval
    const finalGuardId = guardId || mapping.guardId;
    if (!finalGuardId) {
      return NextResponse.json(
        { error: "Guard selection is required for approval" },
        { status: 400 },
      );
    }

    // Verify guard exists
    const guard = await db.guard.findUnique({
      where: { id: finalGuardId },
    });

    if (!guard) {
      return NextResponse.json(
        { error: "Selected guard not found" },
        { status: 404 },
      );
    }

    await db.lineMapping.update({
      where: { id },
      data: {
        guardId: finalGuardId,
        isVerified: true,
        mappedBy: "admin",
      },
    });

    if (lineClient && mapping.lineUserId) {
      try {
        await lineClient.pushMessage(mapping.lineUserId, {
          type: "text",
          text: "✅ ลงทะเบียนเรียบร้อยแล้วครับ ครั้งถัดไปไม่ต้องใส่รหัสผ่านอีก",
        });
      } catch (lineError) {
        console.error("Failed to send LINE notification:", lineError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Mapping approved successfully",
    });
  } catch (error) {
    console.error("Error in /api/line-mapping/approve/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
