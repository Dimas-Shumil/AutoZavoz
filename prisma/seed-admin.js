require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Администратор';

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть указаны в .env');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.adminUser.upsert({
    where: {
      email: ADMIN_EMAIL.toLowerCase().trim(),
    },
    update: {
      passwordHash,
      name: ADMIN_NAME,
      isActive: true,
      role: 'admin',
    },
    create: {
      email: ADMIN_EMAIL.toLowerCase().trim(),
      passwordHash,
      name: ADMIN_NAME,
      isActive: true,
      role: 'admin',
    },
  });

  console.log('Администратор создан/обновлён');
  console.log(`EMAIL: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Seed admin error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
