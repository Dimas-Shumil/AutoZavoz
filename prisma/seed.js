const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');

const prisma = new PrismaClient();

async function main() {
  const title = 'Toyota Land Cruiser 300';

  await prisma.car.upsert({
    where: {
      slug: 'toyota-land-cruiser-300'
    },
    update: {},
    create: {
      title,
      slug: slugify(title, { lower: true, strict: true }),
      price: 'от 9 450 000 ₽',
      badge: 'Под заказ в Японии',
      grade: '4.8',
      year: '2023',
      engine: '3.5 л (415 л.с.) Бензин',
      mileage: '27 000 км',
      drive: 'Полный (4WD)',
      gearbox: 'Автомат',
      complectation: 'ZX',
      auctionUrl: 'https://auc.tajp.com/',
      image: '/site/img/Audi-Q2L/audiq2l.jpg',
      previewImage: '/site/img/Audi-Q2L/audiq2l-gr.png',
      isActive: true,
      sortOrder: 1
    }
  });
}

main()
  .then(async () => {
    console.log('Seed completed');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
