const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'avtozavoz19@vaultgavcoregaragepanel';
  const password = 'Hp_X!15Dertyiaz29176Champ789-1678fhmwsu2#$sdfg6fgjhalgh11';

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.deleteMany();

  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: 'ShumDev Admin',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('Администратор пересоздан');
  console.log('EMAIL:', email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
