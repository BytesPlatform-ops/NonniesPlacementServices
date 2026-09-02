-- CreateEnum
CREATE TYPE "SmsEncoding" AS ENUM ('GSM7', 'UCS2');

-- CreateEnum
CREATE TYPE "SmsOptOutType" AS ENUM ('STOP', 'START', 'HELP');

-- CreateEnum
CREATE TYPE "CommunicationSmsTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationSmsCampaignStatus" AS ENUM ('DRAFT', 'READY', 'QUEUED', 'SENDING', 'COMPLETED', 'PARTIALLY_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationSmsRecipientStatus" AS ENUM ('EXCLUDED', 'QUEUED', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED', 'CANCELLED', 'DELIVERY_UNKNOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommunicationInboundReviewReason" ADD VALUE 'UNKNOWN_PHONE';
ALTER TYPE "CommunicationInboundReviewReason" ADD VALUE 'PHONE_CONFLICT';
ALTER TYPE "CommunicationInboundReviewReason" ADD VALUE 'UNKNOWN_BUSINESS_NUMBER';
ALTER TYPE "CommunicationInboundReviewReason" ADD VALUE 'INVALID_PROVIDER_PAYLOAD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'UNDELIVERED';

-- AlterTable
ALTER TABLE "communication_conversations" ADD COLUMN     "businessNumber" TEXT,
ADD COLUMN     "originSmsCampaignId" UUID;

-- AlterTable
ALTER TABLE "communication_inbound_email_reviews" ADD COLUMN     "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL';

-- AlterTable
ALTER TABLE "communication_messages" ADD COLUMN     "encoding" "SmsEncoding",
ADD COLUMN     "providerSegmentCount" INTEGER,
ADD COLUMN     "segmentCount" INTEGER,
ADD COLUMN     "smsOptOutType" "SmsOptOutType",
ADD COLUMN     "undeliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "communication_sms_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommunicationSmsTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_sms_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CommunicationSmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" UUID,
    "bodySnapshot" TEXT,
    "audienceConfig" JSONB NOT NULL,
    "eligibleRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "excludedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedSegmentCount" INTEGER NOT NULL DEFAULT 0,
    "gsm7RecipientCount" INTEGER NOT NULL DEFAULT 0,
    "ucs2RecipientCount" INTEGER NOT NULL DEFAULT 0,
    "multiSegmentCount" INTEGER NOT NULL DEFAULT 0,
    "longestBodyChars" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_sms_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_sms_campaign_recipients" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "firstNameSnapshot" TEXT,
    "lastNameSnapshot" TEXT,
    "organizationNameSnapshot" TEXT,
    "bodySnapshot" TEXT NOT NULL,
    "encodingSnapshot" "SmsEncoding" NOT NULL,
    "estimatedSegmentCount" INTEGER NOT NULL DEFAULT 1,
    "exclusionReason" TEXT,
    "deliveryStatus" "CommunicationSmsRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "internalMessageId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "actualFromNumber" TEXT,
    "providerSegmentCount" INTEGER,
    "conversationId" UUID,
    "messageId" UUID,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "undeliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessageSafe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_sms_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_sms_templates_status_idx" ON "communication_sms_templates"("status");

-- CreateIndex
CREATE INDEX "communication_sms_campaigns_status_idx" ON "communication_sms_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "communication_sms_campaign_recipients_internalMessageId_key" ON "communication_sms_campaign_recipients"("internalMessageId");

-- CreateIndex
CREATE INDEX "communication_sms_campaign_recipients_campaignId_deliverySt_idx" ON "communication_sms_campaign_recipients"("campaignId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "communication_sms_campaign_recipients_deliveryStatus_idx" ON "communication_sms_campaign_recipients"("deliveryStatus");

-- CreateIndex
CREATE INDEX "communication_sms_campaign_recipients_providerMessageId_idx" ON "communication_sms_campaign_recipients"("providerMessageId");

-- CreateIndex
CREATE INDEX "communication_conversations_channel_contactId_businessNumbe_idx" ON "communication_conversations"("channel", "contactId", "businessNumber");

-- CreateIndex
CREATE INDEX "communication_inbound_email_reviews_channel_status_idx" ON "communication_inbound_email_reviews"("channel", "status");

-- AddForeignKey
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_originSmsCampaignId_fkey" FOREIGN KEY ("originSmsCampaignId") REFERENCES "communication_sms_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_sms_campaigns" ADD CONSTRAINT "communication_sms_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "communication_sms_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_sms_campaign_recipients" ADD CONSTRAINT "communication_sms_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "communication_sms_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

