const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../db");
const requirePushAdmin = require("../middleware/requirePushAdmin");
const pushOrigin = require("../middleware/push-origin");
const {
  validateEndpoint,
  validateSubscription,
} = require("../lib/push-validation");
const { getPushConfig, sendTestToDevice } = require("../services/push.service");
const router = express.Router();
router.use("/admin/push", requirePushAdmin, (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const mutationLimit = rateLimit({
  windowMs: 60000,
  limit: 20,
  keyGenerator: (req) => String(req.session.admin.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Подождите минуту и повторите." },
});
const testLimit = rateLimit({
  windowMs: 60000,
  limit: 3,
  keyGenerator: (req) => String(req.session.admin.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Слишком много тестов. Подождите минуту.",
  },
});
router.get("/admin/push/config", (_req, res) => {
  res.json({ success: true, ...getPushConfig() });
});
router.post(
  "/admin/push/status",
  pushOrigin,
  mutationLimit,
  async (req, res) => {
    const endpoint = validateEndpoint(req.body?.endpoint);
    const subscribed = Boolean(
      await prisma.pushSubscription.findFirst({
        where: { endpoint, adminId: req.session.admin.id },
        select: { id: true },
      }),
    );
    res.json({ success: true, subscribed });
  },
);
router.post(
  "/admin/push/subscribe",
  pushOrigin,
  mutationLimit,
  async (req, res) => {
    if (!getPushConfig().configured)
      return res
        .status(503)
        .json({ success: false, message: "Уведомления временно недоступны." });
    const subscription = validateSubscription(req.body);
    const adminId = req.session.admin.id;
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
      });
      if (existing && existing.adminId !== adminId) {
        const error = new Error(
          "Подписка принадлежит другому аккаунту. Отключите её в браузере и включите заново.",
        );
        error.status = 409;
        throw error;
      }
      return tx.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          ...subscription,
          adminId,
          userAgent: String(req.get("user-agent") || "").slice(0, 500),
        },
        update: { p256dh: subscription.p256dh, auth: subscription.auth },
      });
    });
    res.json({ success: true, subscriptionId: saved.id });
  },
);
router.post(
  "/admin/push/unsubscribe",
  pushOrigin,
  mutationLimit,
  async (req, res) => {
    const endpoint = validateEndpoint(req.body?.endpoint);
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, adminId: req.session.admin.id },
    });
    res.json({ success: true });
  },
);
router.post("/admin/push/test", pushOrigin, testLimit, async (req, res) => {
  const result = await sendTestToDevice(
    req.session.admin.id,
    validateEndpoint(req.body?.endpoint),
  );
  if (result.disabled)
    return res
      .status(503)
      .json({ success: false, message: "Уведомления временно недоступны." });
  if (result.missing)
    return res
      .status(409)
      .json({
        success: false,
        message: "Включите уведомления на этом устройстве.",
      });
  if (result.failed)
    return res
      .status(502)
      .json({
        success: false,
        message: "Сервис push не принял уведомление. Попробуйте позже.",
      });
  res.json({ success: true, sent: 1 });
});
router.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res
    .status(status)
    .json({
      success: false,
      message:
        status < 500
          ? error.message
          : "Не удалось выполнить операцию с уведомлениями.",
    });
});
module.exports = router;
