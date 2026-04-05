import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // TODO: Re-enable admin authentication after testing
    // const session = await auth.api.getSession({ headers: req.headers });
    // if (!session) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized. Admin access required.' },
    //     { status: 401 }
    //   );
    // }

    const { id } = await params;

    const site = await db.site.findUnique({
      where: { id },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const code = generateSixDigitCode();
    const hash = await bcrypt.hash(code, 10);

    await db.site.update({
      where: { id },
      data: {
        checkinPasswordHash: hash,
        passwordUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      code,
      message:
        "Password generated successfully. This code will only be shown once.",
    });
  } catch (error) {
    console.error("Error in /api/sites/[id]/generate-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
