const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createECDH, randomBytes } = require("node:crypto");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "avtozavoz-push-"));
const database = path.join(directory, "test.db");
process.env.DATABASE_URL = `file:${database}`;
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-only-123456789";
for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "TO_EMAIL"])
  process.env[key] = "test";
process.env.SMTP_PORT = "465";
const webpush = require("web-push");
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = "mailto:test@example.com";
const deliveries = [];
let deliveryError = null;
webpush.sendNotification = async (sub, payload) => {
  deliveries.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  if (deliveryError) throw deliveryError;
};
require("nodemailer").createTransport = () => ({
  verify() {},
  async sendMail() {
    throw Object.assign(new Error("SMTP offline"), { code: "ETIMEDOUT" });
  },
});
const sqlite = new DatabaseSync(database);
sqlite.exec("PRAGMA foreign_keys = ON");
for (const name of fs
  .readdirSync(path.join(__dirname, "../prisma/migrations"))
  .sort()) {
  const file = path.join(
    __dirname,
    "../prisma/migrations",
    name,
    "migration.sql",
  );
  if (fs.existsSync(file)) sqlite.exec(fs.readFileSync(file, "utf8"));
}
sqlite.close();
const prisma = require("../src/db");
const { app, sessionStore } = require("../server");
const push = require("../src/services/push.service");
const { createLead } = require("../src/services/leads.service");
const {
  createDeliveryWorker,
} = require("../src/services/push-delivery.service");
const { validateSubscription } = require("../src/lib/push-validation");
const bcrypt = require("bcrypt");
let server, base, cookie, cookie2, admin, admin2;
const origin = "http://localhost:3000";
function subscription(token = "one") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${token}`,
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
}
async function request(
  url,
  { method = "GET", body, auth = cookie, requestOrigin = origin } = {},
) {
  return fetch(base + url, {
    method,
    headers: {
      ...(auth ? { Cookie: auth } : {}),
      ...(requestOrigin === undefined ? {} : { Origin: requestOrigin }),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}
async function login(email) {
  const response = await request("/api/admin/login", {
    method: "POST",
    auth: "",
    body: { email, password: "password-test" },
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
async function subscribe(sub, auth = cookie) {
  const response = await request("/api/admin/push/subscribe", {
    method: "POST",
    body: sub,
    auth,
  });
  assert.equal(response.status, 200, await response.text());
}
async function reset() {
  await prisma.pushDeliveryJob.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.adminUser.updateMany({ data: { isActive: true } });
  deliveries.length = 0;
  deliveryError = null;
}
const logger = { error() {} };
test.before(async () => {
  const passwordHash = await bcrypt.hash("password-test", 4);
  admin = await prisma.adminUser.create({
    data: { email: "one@example.com", passwordHash },
  });
  admin2 = await prisma.adminUser.create({
    data: { email: "two@example.com", passwordHash },
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  cookie = await login(admin.email);
  cookie2 = await login(admin2.email);
});
test.after(async () => {
  sessionStore.stopInterval();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true });
});
test.beforeEach(reset);
test("rejects local, arbitrary, credential-bearing and deceptive endpoints", () => {
  const sub = subscription();
  for (const endpoint of [
    "http://fcm.googleapis.com/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user@fcm.googleapis.com/x",
    "https://example.com/x",
  ])
    assert.throws(() => validateSubscription({ ...sub, endpoint }));
  assert.doesNotThrow(() => validateSubscription(sub));
  assert.throws(() =>
    validateSubscription({
      ...sub,
      keys: { ...sub.keys, p256dh: "A".repeat(87) },
    }),
  );
});
test("unauthorized access and cross-site mutations are blocked", async () => {
  assert.equal(
    (await request("/api/admin/push/config", { auth: "" })).status,
    401,
  );
  assert.equal(
    (
      await request("/api/admin/push/subscribe", {
        method: "POST",
        body: subscription(),
        requestOrigin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/push/subscribe", {
        method: "POST",
        body: subscription(),
        requestOrigin: "null",
      })
    ).status,
    403,
  );
});
test("a disabled admin cannot use an existing session", async () => {
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { isActive: false },
  });
  assert.equal((await request("/api/admin/push/config")).status, 401);
});
test("a subscription cannot silently move between accounts", async () => {
  const sub = subscription();
  await subscribe(sub);
  assert.equal(
    (
      await request("/api/admin/push/subscribe", {
        method: "POST",
        auth: cookie2,
        body: sub,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await prisma.pushSubscription.findUnique({
        where: { endpoint: sub.endpoint },
      })
    ).adminId,
    admin.id,
  );
});
test("test push targets only this device and never another account", async () => {
  const a = subscription("a"),
    b = subscription("b"),
    c = subscription("c");
  await subscribe(a);
  await subscribe(b);
  await subscribe(c, cookie2);
  assert.equal(
    (
      await request("/api/admin/push/test", {
        method: "POST",
        body: { endpoint: a.endpoint },
      })
    ).status,
    200,
  );
  assert.deepEqual(
    deliveries.map((x) => x.endpoint),
    [a.endpoint],
  );
  assert.equal(
    (
      await request("/api/admin/push/test", {
        method: "POST",
        body: { endpoint: c.endpoint },
      })
    ).status,
    409,
  );
});
test("both public form endpoints atomically queue delivery; SMTP failure still returns success", async () => {
  await subscribe(subscription());
  const general = await request("/api/send", {
    method: "POST",
    auth: "",
    body: {
      name: "Павел",
      phone: "+79991234567",
      email: "pavel@example.com",
      form_time: Date.now() - 10000,
      comment: "Расчёт",
    },
  });
  assert.equal(general.status, 200);
  assert.equal((await general.json()).success, true);
  const car = await request("/api/leads", {
    method: "POST",
    auth: "",
    body: { phone: "+79991234567", customerName: "Павел", carTitle: "Toyota" },
  });
  assert.equal(car.status, 201);
  assert.equal(await prisma.lead.count(), 2);
  assert.equal(await prisma.pushDeliveryJob.count(), 2);
});
test("invalid forms do not create a lead or delivery job", async () => {
  assert.equal(
    (
      await request("/api/leads", {
        method: "POST",
        auth: "",
        body: { phone: "123" },
      })
    ).status,
    400,
  );
  assert.equal(await prisma.lead.count(), 0);
  assert.equal(await prisma.pushDeliveryJob.count(), 0);
});
test("transaction rolls back the lead if creation of delivery jobs fails", async () => {
  await subscribe(subscription());
  const original = prisma.$transaction.bind(prisma);
  prisma.$transaction = (callback) =>
    original((tx) =>
      callback(
        new Proxy(tx, {
          get(target, prop) {
            if (prop === "pushDeliveryJob")
              return {
                createMany() {
                  throw new Error("queue failure");
                },
              };
            return target[prop];
          },
        }),
      ),
    );
  try {
    await assert.rejects(createLead({ phone: "+79991234567" }));
  } finally {
    prisma.$transaction = original;
  }
  assert.equal(await prisma.lead.count(), 0);
});
test("successful delivery is recorded per device and is not resent on the next cycle", async () => {
  await subscribe(subscription("a"));
  await subscribe(subscription("b"));
  const lead = await createLead({ phone: "+79991234567" });
  const worker = createDeliveryWorker({ prisma, push, logger });
  await worker.run();
  await worker.run();
  assert.equal(deliveries.length, 2);
  assert.equal(
    await prisma.pushDeliveryJob.count({ where: { status: "delivered" } }),
    2,
  );
  assert.equal(
    deliveries[0].payload.url,
    `/admin/leads.html?leadId=${lead.id}`,
  );
  assert.ok(!deliveries[0].payload.body.includes(lead.phone));
});
test("403 preserves the subscription and queues a delayed retry", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  deliveryError = { statusCode: 403 };
  const worker = createDeliveryWorker({ prisma, push, logger });
  await worker.run();
  await worker.run();
  assert.equal(await prisma.pushSubscription.count(), 1);
  const job = await prisma.pushDeliveryJob.findFirst();
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.equal(deliveries.length, 1);
});
test("410 removes the dead subscription and cascades its queued jobs", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  deliveryError = { statusCode: 410 };
  await createDeliveryWorker({ prisma, push, logger }).run();
  assert.equal(await prisma.pushSubscription.count(), 0);
  assert.equal(await prisma.pushDeliveryJob.count(), 0);
});
test("two workers claim a job only once", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  await Promise.all([
    createDeliveryWorker({ prisma, push, logger: console }).run(),
    createDeliveryWorker({ prisma, push, logger: console }).run(),
  ]);
  assert.equal(deliveries.length, 1);
});
test("an expired lease is recovered after process restart", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  await prisma.pushDeliveryJob.updateMany({
    data: {
      status: "processing",
      lockedAt: new Date(Date.now() - 120000),
      leaseToken: "old-process",
    },
  });
  await createDeliveryWorker({ prisma, push, logger }).run();
  assert.equal(deliveries.length, 1);
});
test("disabled push does not consume retries", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  await createDeliveryWorker({
    prisma,
    push: { ...push, getPushConfig: () => ({ configured: false }) },
    logger,
  }).run();
  assert.equal((await prisma.pushDeliveryJob.findFirst()).attempts, 0);
});
test("the retry limit stops a failing job without deleting its subscription", async () => {
  await subscribe(subscription());
  await createLead({ phone: "+79991234567" });
  await prisma.pushDeliveryJob.updateMany({ data: { attempts: 5 } });
  deliveryError = { statusCode: 503 };
  await createDeliveryWorker({ prisma, push, logger }).run();
  assert.equal((await prisma.pushDeliveryJob.findFirst()).status, "failed");
  assert.equal(await prisma.pushSubscription.count(), 1);
});
test("logout revokes only the current device and its pending jobs", async () => {
  const sub = subscription("logout");
  const other = subscription("other");
  await subscribe(sub);
  await subscribe(other);
  await createLead({ phone: "+79991234567" });
  assert.equal(
    (
      await request("/api/admin/logout", {
        method: "POST",
        body: { endpoint: sub.endpoint },
      })
    ).status,
    200,
  );
  assert.equal(await prisma.pushSubscription.count(), 1);
  assert.equal(await prisma.pushDeliveryJob.count(), 1);
  assert.equal((await request("/api/admin/push/config")).status, 401);
  cookie = await login(admin.email);
});
