const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const prisma = require('../db');
const upload = require('../config/multer');
const requireAdminAuth = require('../middleware/requireAdminAuth');

const router = express.Router();

router.get(
  '/admin/cars',
  requireAdminAuth,
  async (req, res) => {
    try {
      const cars = await prisma.car.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.status(200).json({
        success: true,
        cars
      });
    } catch (error) {
      console.error('Admin cars loading error:', error);

      return res.status(500).json({
        success: false,
        message: 'Ошибка загрузки автомобилей'
      });
    }
  }
);

router.post(
  '/admin/cars',
  requireAdminAuth,
  upload.fields([
    {
      name: 'previewImage',
      maxCount: 1
    },
    {
      name: 'image',
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const previewImageFile = req.files?.previewImage?.[0];
      const imageFile = req.files?.image?.[0];

      if (!previewImageFile || !imageFile) {
        return res.status(400).json({
          success: false,
          message: 'Загрузите оба изображения'
        });
      }

      const previewOutput = `optimized-${previewImageFile.filename}.webp`;
      const imageOutput = `optimized-${imageFile.filename}.webp`;

      const uploadsDir = path.join(process.cwd(), 'uploads', 'cars');

      await sharp(previewImageFile.path)
        .resize(800)
        .webp({ quality: 82 })
        .toFile(path.join(uploadsDir, previewOutput));

      await sharp(imageFile.path)
        .resize(1600)
        .webp({ quality: 86 })
        .toFile(path.join(uploadsDir, imageOutput));

      fs.unlinkSync(previewImageFile.path);
      fs.unlinkSync(imageFile.path);

      const car = await prisma.car.create({
        data: {
          title: String(req.body.title || '').trim(),
          slug:
            (req.body.title || '')
              .toLowerCase()
              .replace(/\s+/g, '-') +
            '-' +
            Date.now(),

          price: req.body.price || '',

          year: req.body.year || '',
          engine: req.body.engine || '',
          mileage: req.body.mileage || '',
          drive: req.body.drive || '',
          gearbox: req.body.gearbox || '',
          grade: req.body.grade || '',
          complectation: req.body.complectation || '',

          previewImage: `/uploads/cars/${previewOutput}`,
          image: `/uploads/cars/${imageOutput}`
        }
      });

      return res.status(201).json({
        success: true,
        car
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: 'Ошибка создания автомобиля'
      });
    }
  }
);

router.put(
  '/admin/cars/:id',
  requireAdminAuth,
  upload.fields([
    {
      name: 'previewImage',
      maxCount: 1
    },
    {
      name: 'image',
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const carId = Number(req.params.id);

      if (!Number.isInteger(carId) || carId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID автомобиля'
        });
      }

      const existingCar = await prisma.car.findUnique({
        where: {
          id: carId
        }
      });

      if (!existingCar) {
        return res.status(404).json({
          success: false,
          message: 'Автомобиль не найден'
        });
      }

      const uploadsDir = path.join(process.cwd(), 'uploads', 'cars');

      let previewImagePath = existingCar.previewImage;
      let imagePath = existingCar.image;

      const previewImageFile = req.files?.previewImage?.[0];
      const imageFile = req.files?.image?.[0];

      if (previewImageFile) {
        const previewOutput = `optimized-${previewImageFile.filename}.webp`;

        await sharp(previewImageFile.path)
          .resize(800)
          .webp({ quality: 82 })
          .toFile(path.join(uploadsDir, previewOutput));

        fs.unlinkSync(previewImageFile.path);

        deleteUploadFile(existingCar.previewImage);

        previewImagePath = `/uploads/cars/${previewOutput}`;
      }

      if (imageFile) {
        const imageOutput = `optimized-${imageFile.filename}.webp`;

        await sharp(imageFile.path)
          .resize(1600)
          .webp({ quality: 86 })
          .toFile(path.join(uploadsDir, imageOutput));

        fs.unlinkSync(imageFile.path);

        deleteUploadFile(existingCar.image);

        imagePath = `/uploads/cars/${imageOutput}`;
      }

      const car = await prisma.car.update({
        where: {
          id: carId
        },
        data: {
          title: String(req.body.title || '').trim(),
          price: req.body.price || '',
          year: req.body.year || '',
          engine: req.body.engine || '',
          mileage: req.body.mileage || '',
          drive: req.body.drive || '',
          gearbox: req.body.gearbox || '',
          grade: req.body.grade || '',
          complectation: req.body.complectation || '',
          previewImage: previewImagePath,
          image: imagePath
        }
      });

      return res.status(200).json({
        success: true,
        car
      });
    } catch (error) {
      console.error('Update car error:', error);

      return res.status(500).json({
        success: false,
        message: 'Ошибка обновления автомобиля'
      });
    }
  }
);

// Дополнительные маршруты для редактирования и удаления автомобилей

router.delete('/admin/cars/:id', requireAdminAuth, async (req, res) => {
  try {
    const carId = Number(req.params.id);

    if (!Number.isInteger(carId) || carId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID автомобиля',
      });
    }

    const car = await prisma.car.findUnique({
      where: {
        id: carId,
      },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Автомобиль не найден',
      });
    }

    const filesToDelete = [car.previewImage, car.image];

    filesToDelete.forEach((filePath) => {
      if (!filePath) return;

      const normalizedPath = filePath.replace(/^\//, '');
      const fullPath = path.join(process.cwd(), normalizedPath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    await prisma.car.delete({
      where: {
        id: carId,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Автомобиль удалён',
    });
  } catch (error) {
    console.error('Delete car error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка удаления автомобиля',
    });
  }
});

function deleteUploadFile(filePath) {
  if (!filePath) return;

  const normalizedPath = filePath.replace(/^\//, '');
  const fullPath = path.join(process.cwd(), normalizedPath);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = router;
