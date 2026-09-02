-- AlterTable
ALTER TABLE "communication_email_campaign_recipients" ADD COLUMN     "dispatchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "communication_messages" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "communication_sms_campaign_recipients" ADD COLUMN     "dispatchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "communication_email_campaign_recipients_deliveryStatus_leas_idx" ON "communication_email_campaign_recipients"("deliveryStatus", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "communication_messages_idempotencyKey_key" ON "communication_messages"("idempotencyKey");

-- CreateIndex
CREATE INDEX "communication_messages_channel_direction_status_idx" ON "communication_messages"("channel", "direction", "status");

-- CreateIndex
CREATE INDEX "communication_sms_campaign_recipients_deliveryStatus_leaseE_idx" ON "communication_sms_campaign_recipients"("deliveryStatus", "leaseExpiresAt");

