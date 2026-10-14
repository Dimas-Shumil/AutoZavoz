const express = require('express');
const prisma = require('../db');
const requireAdminAuth = require('../middleware/requireAdminAuth');
const { notifyAboutNewLead } = require('../services/push.service');

const router = express.Router();

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizePhone(value) {
  return normalizeString(value).replace(/[^\d+]/g, '');
}

function isValidPhone(phone) {
  return phone.replace(/\D/g, '').length >= 10;
}

router.post('/leads', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона',
      });
    }

    const carId = Number(req.body.carId);

    let car = null;

    if (Number.isInteger(carId) && carId > 0) {
      car = await prisma.car.findUnique({
        where: {
          id: carId,
        },
      });
    }

    const lead = await prisma.lead.create({
      data: {
        leadType: normalizeNullableString(req.body.leadType) || 'general',
        source: normalizeNullableString(req.body.source),

        customerName: normalizeNullableString(req.body.customerName),
        phone,
        messenger: normalizeNullableString(req.body.messenger),
        city: normalizeNullableString(req.body.city),
        budget: normalizeNullableString(req.body.budget),
        message: normalizeNullableString(req.body.message),

        carId: car ? car.id : null,
        carTitleSnapshot: car ? car.title : normalizeNullableString(req.body.carTitle),
        carSlugSnapshot: car ? car.slug : normalizeNullableString(req.body.carSlug),

        status: 'new',
      },
    });

    void notifyAboutNewLead(lead);

    return res.status(201).json({
      success: true,
      message: 'Заявка отправлена',
      lead,
    });
  } catch (error) {
    console.error('Lead create error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка отправки заявки',
    });
  }
});

router.get('/admin/leads', requireAdminAuth, async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        car: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      leads,
    });
  } catch (error) {
    console.error('Admin leads loading error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка загрузки заявок',
    });
  }
});

router.patch('/admin/leads/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const status = normalizeString(req.body.status);

    const allowedStatuses = ['new', 'in_work', 'done', 'cancelled'];

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID заявки',
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный статус заявки',
      });
    }

    const lead = await prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error('Lead status update error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка изменения статуса заявки',
    });
  }
});

router.delete('/admin/leads/:id', requireAdminAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID заявки',
      });
    }

    await prisma.lead.delete({
      where: {
        id: leadId,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Заявка удалена',
    });
  } catch (error) {
    console.error('Lead delete error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка удаления заявки',
    });
  }
});

module.exports = router;
