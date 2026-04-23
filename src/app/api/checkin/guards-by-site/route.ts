import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json(
        { error: 'siteId parameter is required' },
        { status: 400 }
      );
    }

    // Get active guards assigned to this site
    const assignments = await db.guardSiteAssignment.findMany({
      where: {
        siteId,
        guard: {
          employmentStatus: 'active',
        },
      },
      include: {
        guard: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            photoUrl: true,
          },
        },
      },
      orderBy: {
        guard: {
          fullName: 'asc',
        },
      },
    });

    const guards = assignments.map((a) => ({
      id: a.guard.id,
      fullName: a.guard.fullName,
      employeeCode: a.guard.employeeCode,
      photoUrl: a.guard.photoUrl,
      isPrimary: a.isPrimary,
    }));

    return NextResponse.json({ guards });
  } catch (error) {
    console.error('Error fetching guards by site:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
