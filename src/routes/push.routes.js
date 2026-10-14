const express = require('express');
const prisma = require('../db');
const requireAdminAuth = require('../middleware/requireAdminAuth');
const { getPushConfig, sendToAdmin } = require('../services/push.service');

const router = express.Router();

function normalizeSubscription(body = {}) {
  const endpoint = String(body.endpoint || '').trim();
  const p256dh = String(body.keys?.p256dh || '').trim();
  const auth = String(body.keys?.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

router.get('/admin/push/config', requireAdminAuth, async (req, res) => {
  const config = getPushConfig();
  const adminId = Number(req.session.admin?.id);

  let subscriptions = 0;

  if (Number.isInteger(adminId) && adminId > 0) {
    subscriptions = await prisma.pushSubscription.count({
      where: { adminId },
    });
  }

  return res.status(200).json({
    success: true,
    configured: config.configured,
    publicKey: config.configured ? config.publicKey : null,
    subscriptions,
  });
});

router.post('/admin/push/subscribe', requireAdminAuth, async (req, res) => {
  const config = getPushConfig();

  if (!config.configured) {
    return res.status(503).json({
      success: false,
      message: 'Web Push пока не настроен: отсутствуют VAPID-ключи.',
    });
  }

  const subscription = normalizeSubscription(req.body);
  const adminId = Number(req.session.admin?.id);

  if (!subscription || !Number.isInteger(adminId) || adminId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Некорректная push-подписка.',
    });
  }

  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      adminId,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    },
    create: {
      adminId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    },
  });

  return res.status(200).json({
    success: true,
    subscriptionId: saved.id,
  });
});

router.post('/admin/push/unsubscribe', requireAdminAuth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  const adminId = Number(req.session.admin?.id);

  if (!endpoint || !Number.isInteger(adminId) || adminId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Некорректная push-подписка.',
    });
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      endpoint,
      adminId,
    },
  });

  return res.status(200).json({ success: true });
});

router.post('/admin/push/test', requireAdminAuth, async (req, res) => {
  const adminId = Number(req.session.admin?.id);

  const result = await sendToAdmin(adminId, {
    title: 'АвтоZавоз — уведомления работают',
    body: 'Тестовое Web Push уведомление успешно отправлено.',
    url: '/admin/leads.html',
    tag: `push-test-${Date.now()}`,
  });

  if (result.disabled) {
    return res.status(503).json({
      success: false,
      message: 'Web Push пока не настроен: отсутствуют VAPID-ключи.',
    });
  }

  if (!result.total) {
    return res.status(409).json({
      success: false,
      message: 'На этом аккаунте пока нет активной push-подписки.',
    });
  }

  if (!result.sent) {
    return res.status(502).json({
      success: false,
      message:
        'Push-подписка найдена, но сервис отклонил доставку. Включите уведомления заново.',
    });
  }

  return res.status(200).json({
    success: true,
    sent: result.sent,
  });
});

module.exports = router;
