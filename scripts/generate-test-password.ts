import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function generateTestPassword() {
  try {
    // Get first site
    const site = await db.site.findFirst();
    
    if (!site) {
      console.log('No sites found. Please create a site first.');
      return;
    }

    // Generate test password "123456"
    const testCode = '123456';
    const hash = await bcrypt.hash(testCode, 10);

    await db.site.update({
      where: { id: site.id },
      data: {
        checkinPasswordHash: hash,
        passwordUpdatedAt: new Date(),
      },
    });

    console.log(`✅ Test password "${testCode}" generated for site "${site.name}" (${site.id})`);
    console.log(`You can now test with: POST /api/checkin/verify-site-password?password=${testCode}&lineUserId=Utest123`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

generateTestPassword();
