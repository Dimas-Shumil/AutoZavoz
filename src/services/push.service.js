const fs = require("node:fs");
const path = require("node:path");
const { createECDH } = require("node:crypto");
const webpush = require("web-push");
const prisma = require("../db");
const { validateSubscription } = require("../lib/push-validation");
function loadConfig() {
  let publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  let privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  let subject = String(process.env.VAPID_SUBJECT || "").trim();
  if (
    !publicKey &&
    !privateKey &&
    !subject &&
    process.env.NODE_ENV === "development"
  ) {
    const file = path.join(__dirname, "../../.local-vapid.json");
    try {
      ({ publicKey, privateKey, subject } = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ));
    } catch (error) {
      if (error.code !== "ENOENT")
        return { configured: false, publicKey: null };
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      subject = "mailto:localhost@avtozavoz.local";
      try {
        fs.writeFileSync(
          file,
          JSON.stringify({ publicKey, privateKey, subject }),
          { mode: 0o600, flag: "wx" },
        );
      } catch {
        return { configured: false, publicKey: null };
      }
    }
  }
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (!ecdh.getPublicKey().equals(Buffer.from(publicKey, "base64url")))
      throw new Error("key pair");
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { configured: true, publicKey };
  } catch {
    return { configured: false, publicKey: null };
  }
}
const config = loadConfig();
const getPushConfig = () => ({ ...config });
function leadNotificationPayload(lead) {
  return {
    title: "Новая заявка — АвтоZавоз",
    body: "Клиент оставил заявку. Откройте админку для просмотра.",
    url: `/admin/leads.html?leadId=${lead.id}`,
    tag: `lead-${lead.id}`,
  };
}
async function sendSubscription(subscription, payload) {
  if (!config.configured) {
    const error = new Error("Push disabled");
    error.statusCode = 503;
    throw error;
  }
  validateSubscription({ endpoint: subscription.endpoint, keys: subscription });
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 86400, urgency: "high", timeout: 10000 },
  );
}
async function sendTestToDevice(adminId, endpoint) {
  if (!config.configured) return { disabled: true };
  const subscription = await prisma.pushSubscription.findFirst({
    where: { adminId, endpoint, admin: { isActive: true } },
  });
  if (!subscription) return { missing: true };
  try {
    await sendSubscription(subscription, {
      title: "АвтоZавоз — уведомления работают",
      body: "Тестовое уведомление для этого устройства.",
      url: "/admin/leads.html",
      tag: `test-${Date.now()}`,
    });
    return { sent: true };
  } catch (error) {
    if ([404, 410].includes(error.statusCode))
      await prisma.pushSubscription.deleteMany({
        where: { id: subscription.id },
      });
    return { failed: true };
  }
}
module.exports = {
  getPushConfig,
  leadNotificationPayload,
  sendSubscription,
  sendTestToDevice,
};
