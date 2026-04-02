import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("Demo12345!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: {
      email: "admin@demo.local",
      name: "Admin User",
      passwordHash: password,
      role: "ADMIN",
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: "analyst@demo.local" },
    update: {},
    create: {
      email: "analyst@demo.local",
      name: "Analyst User",
      passwordHash: password,
      role: "ANALYST",
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@demo.local" },
    update: {},
    create: {
      email: "viewer@demo.local",
      name: "Viewer User",
      passwordHash: password,
      role: "VIEWER",
    },
  });

  const count = await prisma.financialRecord.count();
  if (count === 0) {
    const now = new Date();
    await prisma.financialRecord.createMany({
      data: [
        {
          amount: 12000,
          type: "INCOME",
          category: "Salary",
          date: new Date(now.getFullYear(), now.getMonth(), 1),
          notes: "Monthly payroll",
          createdById: admin.id,
        },
        {
          amount: 450,
          type: "EXPENSE",
          category: "Software",
          date: new Date(now.getFullYear(), now.getMonth(), 3),
          notes: "SaaS subscriptions",
          createdById: admin.id,
        },
        {
          amount: 2800,
          type: "INCOME",
          category: "Consulting",
          date: new Date(now.getFullYear(), now.getMonth(), 8),
          createdById: analyst.id,
        },
        {
          amount: 120,
          type: "EXPENSE",
          category: "Travel",
          date: new Date(now.getFullYear(), now.getMonth(), 10),
          notes: "Client visit",
          createdById: analyst.id,
        },
      ],
    });
  }

  console.log("Seed complete: admin@demo.local, analyst@demo.local, viewer@demo.local / Demo12345!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
