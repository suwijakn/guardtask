import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    // Get first guard and site
    const guard = await db.guard.findFirst();
    const site = await db.site.findFirst();

    if (!guard || !site) {
      return NextResponse.json({ 
        error: 'Need at least 1 guard and 1 site in database',
        hasGuards: !!guard,
        hasSites: !!site,
      }, { status: 400 });
    }

    // Create test LINE mapping
    const mapping = await db.lineMapping.create({
      data: {
        lineUserId: 'Utest' + Date.now(),
        displayName: 'Test User',
        guardId: guard.id,
        siteId: site.id,
        mappingMethod: 'auto_checkin',
        isVerified: false,
      },
      include: {
        guard: true,
        site: true,
      },
    });

    return NextResponse.json({ 
      success: true,
      mapping,
      message: 'Test mapping created. Check /admin/line-mapping now!',
    });
  } catch (error) {
    console.error('Error creating test mapping:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
