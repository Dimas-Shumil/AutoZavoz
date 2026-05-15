const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../db');

const router = express.Router();

router.post('/admin/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Введите email и пароль'
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    req.session.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    };

    return res.status(200).json({
      success: true,
      admin: req.session.admin
    });
  } catch (error) {
    console.error('Admin login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('shumdev_cms_sid');

    return res.status(200).json({
      success: true
    });
  });
});

router.get('/admin/me', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({
      success: false,
      message: 'Не авторизован'
    });
  }

  return res.status(200).json({
    success: true,
    admin: req.session.admin
  });
});

module.exports = router;
