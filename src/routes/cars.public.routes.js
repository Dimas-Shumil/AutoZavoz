const express = require('express');
const prisma = require('../db');

const router = express.Router();

router.get('/cars', async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return res.status(200).json({
      success: true,
      cars
    });
  } catch (error) {
    console.error('Ошибка получения машин:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

module.exports = router;
