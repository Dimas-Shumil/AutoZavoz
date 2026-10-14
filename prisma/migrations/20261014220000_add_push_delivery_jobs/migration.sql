CREATE TABLE "PushDeliveryJob" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "leadId" INTEGER NOT NULL,
 "subscriptionId" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'pending',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedAt" DATETIME,
 "leaseToken" TEXT,
 "deliveredAt" DATETIME,
 "lastErrorCode" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PushDeliveryJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PushDeliveryJob_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushDeliveryJob_leadId_subscriptionId_key" ON "PushDeliveryJob"("leadId", "subscriptionId");
CREATE INDEX "PushDeliveryJob_status_nextAttemptAt_idx" ON "PushDeliveryJob"("status", "nextAttemptAt");
CREATE INDEX "PushDeliveryJob_subscriptionId_idx" ON "PushDeliveryJob"("subscriptionId");
