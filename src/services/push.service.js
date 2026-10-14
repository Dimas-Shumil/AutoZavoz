const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const prisma = require('../db');

const DEV_VAPID_FILE = path.join(__dirname, '../../.local-vapid.json');

function loadDevelopmentVapid() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  try {
    if (fs.existsSync(DEV_VAPID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DEV_VAPID_FILE, 'utf8'));

      if (saved.publicKey && saved.privateKey && saved.subject) {
        return saved;
      }
    }

    const keys = webpush.generateVAPIDKeys();
    const generated = {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:localhost@avtozavoz.local',
    };

    fs.writeFileSync(
      DEV_VAPID_FILE,
      JSON.stringify(generated, null, 2),
      { mode: 0o600 },
    );

    console.log('Web Push: созданы локальные VAPID-ключи для localhost');
    return generated;
  } catch (error) {
    console.error('Web Push local VAPID error:', error.message);
    return null;
  }
}

function getPushConfig() {
  const envConfig = {
    publicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim(),
    privateKey: String(process.env.VAPID_PRIVATE_KEY || '').trim(),
    subject: String(process.env.VAPID_SUBJECT || '').trim(),
  };

  if (envConfig.publicKey && envConfig.privateKey && envConfig.subject) {
    return {
      configured: true,
      ...envConfig,
      source: 'env',
    };
  }

  const developmentConfig = loadDevelopmentVapid();

  if (developmentConfig) {
    return {
      configured: true,
      ...developmentConfig,
      source: 'development',
    };
  }

  return {
    configured: false,
    publicKey: '',
    privateKey: '',
    subject: '',
    source: 'none',
  };
}

function configureWebPush() {
  const config = getPushConfig();

  if (config.configured) {
    webpush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
  }

  return config;
}

const pushConfig = configureWebPush();

function buildSubscription(subscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

async function sendToSubscriptions(subscriptions, payload) {
  if (!pushConfig.configured) {
    return { sent: 0, failed: 0, total: 0, disabled: true };
  }

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        buildSubscription(subscription),
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error) {
      failed += 1;

      if (error && [401, 403, 404, 410].includes(error.statusCode)) {
        await prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => {});
      }

      console.error(
        'Web Push error:',
        error?.statusCode || '',
        error?.message || error,
      );
    }
  }

  return {
    sent,
    failed,
    total: subscriptions.length,
    disabled: false,
  };
}

async function sendToAdmin(adminId, payload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { adminId },
  });

  return sendToSubscriptions(subscriptions, payload);
}

async function sendToActiveAdmins(payload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      admin: {
        isActive: true,
      },
    },
  });

  return sendToSubscriptions(subscriptions, payload);
}

function leadNotificationPayload(lead) {
  const customer = String(lead.customerName || '').trim() || 'Клиент';
  const car = String(lead.carTitleSnapshot || '').trim();
  const phone = String(lead.phone || '').trim();

  const parts = [
    customer,
    phone,
    car ? `Авто: ${car}` : null,
  ].filter(Boolean);

  return {
    title: 'Новая заявка — АвтоZавоз',
    body: parts.join(' · '),
    url: '/admin/leads.html',
    tag: `lead-${lead.id}`,
  };
}

async function notifyAboutNewLead(lead) {
  try {
    return await sendToActiveAdmins(leadNotificationPayload(lead));
  } catch (error) {
    console.error('New lead push error:', error?.message || error);
    return { sent: 0, error: true };
  }
}

module.exports = {
  getPushConfig,
  notifyAboutNewLead,
  sendToAdmin,
};
