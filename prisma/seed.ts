import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data (optional - comment out if you want to keep existing data)
  await prisma.conversation.deleteMany();
  await prisma.guardPhoto.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.shiftCheckin.deleteMany();
  await prisma.manpowerAlert.deleteMany();
  await prisma.lineMapping.deleteMany();
  await prisma.guardSiteAssignment.deleteMany();
  await prisma.guard.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();
  await prisma.secretaryPing.deleteMany();

  // 1. Create Sites
  console.log("Creating sites...");
  const kibun = await prisma.site.create({
    data: {
      name: "Kibun Thailand",
      shortName: "kibun",
      requiredGuardsDay: 7,
      requiredGuardsNight: 7,
      shiftStartDay: "07:00",
      shiftStartNight: "19:00",
      photoRouting: {
        checkin: {
          send_to_client_group: false,
        },
      },
    },
  });

  const siamClothing = await prisma.site.create({
    data: {
      name: "Siam Clothing",
      shortName: "siam_clothing",
      requiredGuardsDay: 3,
      requiredGuardsNight: 2,
      shiftStartDay: "07:00",
      shiftStartNight: "19:00",
      photoRouting: {
        checkin: {
          send_to_client_group: true,
          client_line_group_id: "TO_BE_CONFIGURED",
        },
      },
    },
  });

  const tkIngot = await prisma.site.create({
    data: {
      name: "T.K. Ingot",
      shortName: "tk_ingot",
      requiredGuardsDay: 2,
      requiredGuardsNight: 2,
      shiftStartDay: "07:00",
      shiftStartNight: "19:00",
    },
  });

  const linde = await prisma.site.create({
    data: {
      name: "Linde Thailand",
      shortName: "linde",
      requiredGuardsDay: 2,
      requiredGuardsNight: 2,
      shiftStartDay: "07:00",
      shiftStartNight: "19:00",
    },
  });

  const devTest = await prisma.site.create({
    data: {
      name: "Dev Test Site",
      shortName: "dev_test",
      requiredGuardsDay: 1,
      requiredGuardsNight: 1,
      shiftStartDay: "07:00",
      shiftStartNight: "19:00",
    },
  });

  console.log(`✓ Created ${5} sites`);

  // 2. Create Guards
  console.log("Creating guards...");
  const guard1 = await prisma.guard.create({
    data: {
      employeeCode: "G-001",
      fullName: "ทดสอบ สมชาย",
      nickname: "ชาย",
      position: "guard",
      currentSiteId: kibun.id,
      startDate: new Date("2024-01-01"),
      employmentStatus: "active",
    },
  });

  const guard2 = await prisma.guard.create({
    data: {
      employeeCode: "G-002",
      fullName: "ทดสอบ สมศักดิ์",
      nickname: "ศักดิ์",
      position: "shift_leader",
      currentSiteId: siamClothing.id,
      startDate: new Date("2024-01-01"),
      employmentStatus: "active",
    },
  });

  const guard3 = await prisma.guard.create({
    data: {
      employeeCode: "G-003",
      fullName: "ทดสอบ สมหญิง",
      nickname: "หญิง",
      position: "guard",
      currentSiteId: tkIngot.id,
      startDate: new Date("2024-01-01"),
      employmentStatus: "active",
    },
  });

  const guard4 = await prisma.guard.create({
    data: {
      employeeCode: "G-099",
      fullName: "ทดสอบ สำรอง",
      nickname: "สำรอง",
      position: "patrol",
      allowAnySite: true,
      startDate: new Date("2024-01-01"),
      employmentStatus: "active",
    },
  });

  console.log(`✓ Created ${4} guards`);

  // 3. Create Guard-Site Assignments
  console.log("Creating guard-site assignments...");
  await prisma.guardSiteAssignment.create({
    data: {
      guardId: guard1.id,
      siteId: kibun.id,
      isPrimary: true,
    },
  });

  await prisma.guardSiteAssignment.create({
    data: {
      guardId: guard2.id,
      siteId: siamClothing.id,
      isPrimary: true,
    },
  });

  await prisma.guardSiteAssignment.create({
    data: {
      guardId: guard3.id,
      siteId: tkIngot.id,
      isPrimary: true,
    },
  });

  console.log(`✓ Created ${3} guard-site assignments`);

  // 4. Admin user created via BetterAuth sign-up
  console.log(
    "Admin user will be created via BetterAuth sign-up at /auth/login",
  );

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
