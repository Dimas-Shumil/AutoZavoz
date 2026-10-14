const { randomUUID } = require("node:crypto");
function createDeliveryWorker({
  prisma,
  push,
  logger = console,
  now = () => new Date(),
}) {
  let running = false;
  let timer = null;
  const due = () => ({
    OR: [
      { status: "pending", nextAttemptAt: { lte: now() } },
      {
        status: "processing",
        lockedAt: { lt: new Date(now().getTime() - 60000) },
      },
    ],
  });
  async function run() {
    if (running || !push.getPushConfig().configured) return;
    running = true;
    try {
      const jobs = await prisma.pushDeliveryJob.findMany({
        where: due(),
        orderBy: { id: "asc" },
        take: 20,
      });
      for (const candidate of jobs) {
        const leaseToken = randomUUID();
        const claim = await prisma.pushDeliveryJob.updateMany({
          where: { id: candidate.id, ...due() },
          data: {
            status: "processing",
            lockedAt: now(),
            leaseToken,
            attempts: { increment: 1 },
          },
        });
        if (!claim.count) continue;
        const job = await prisma.pushDeliveryJob.findUnique({
          where: { id: candidate.id },
          include: { lead: true, subscription: { include: { admin: true } } },
        });
        if (!job) continue;
        const where = { id: job.id, leaseToken };
        if (!job.subscription.admin.isActive) {
          await prisma.pushDeliveryJob.updateMany({
            where,
            data: { status: "cancelled", leaseToken: null, lockedAt: null },
          });
          continue;
        }
        try {
          await push.sendSubscription(
            job.subscription,
            push.leadNotificationPayload(job.lead),
          );
          await prisma.pushDeliveryJob.updateMany({
            where,
            data: {
              status: "delivered",
              deliveredAt: now(),
              lockedAt: null,
              leaseToken: null,
              lastErrorCode: null,
            },
          });
        } catch (error) {
          const code = Number(error.statusCode || error.status) || 0;
          if ([404, 410].includes(code)) {
            await prisma.pushSubscription.deleteMany({
              where: { id: job.subscriptionId },
            });
            continue;
          }
          const terminal = job.attempts >= 6 || code === 400;
          await prisma.pushDeliveryJob.updateMany({
            where,
            data: {
              status: terminal ? "failed" : "pending",
              lockedAt: null,
              leaseToken: null,
              lastErrorCode: String(code || "network"),
              nextAttemptAt: new Date(
                now().getTime() +
                  Math.min(3600000, 30000 * 2 ** (job.attempts - 1)),
              ),
            },
          });
          logger.error("Web Push delivery failed:", {
            jobId: job.id,
            code: code || "network",
          });
        }
      }
    } catch (error) {
      logger.error("Web Push queue unavailable:", error.code || "internal");
    } finally {
      running = false;
    }
  }
  function start() {
    if (timer) return;
    void run();
    timer = setInterval(() => {
      void run();
    }, 5000);
    timer.unref();
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  return { run, start, stop };
}
module.exports = { createDeliveryWorker };
