#!/usr/bin/env node
/**
 * prisma/seed.js — Seed AdminUser data for MCP CTF
 *
 * Usage:
 *   node prisma/seed.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Clear existing entries (optional)
  await prisma.adminUser.deleteMany();

  // Seed with sample admin users
  await prisma.adminUser.createMany({
    data: [
      { username: "alice", role: "superadmin" },
      { username: "bob", role: "admin" },
      { username: "eve", role: "auditor" },
      { username: "mallory", role: "tester" },
    ],
  });

  console.log("✅ AdminUser table seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
