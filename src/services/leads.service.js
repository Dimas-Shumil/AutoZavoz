const prisma = require("../db");
// A lead and its per-device delivery jobs commit together.
async function createLead(data) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({ data });
    const subscriptions = await tx.pushSubscription.findMany({
      where: { admin: { isActive: true } },
      select: { id: true },
    });
    if (subscriptions.length)
      await tx.pushDeliveryJob.createMany({
        data: subscriptions.map((subscription) => ({
          leadId: lead.id,
          subscriptionId: subscription.id,
          nextAttemptAt: new Date(),
        })),
      });
    return lead;
  });
}
module.exports = { createLead };
