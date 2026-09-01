-- CreateEnum
CREATE TYPE "CommunicationEmailTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationEmailCampaignStatus" AS ENUM ('DRAFT', 'READY', 'QUEUED', 'SENDING', 'COMPLETED', 'PARTIALLY_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationEmailRecipientStatus" AS ENUM ('EXCLUDED', 'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'UNSUBSCRIBED', 'CANCELLED', 'DELIVERY_UNKNOWN');

-- CreateEnum
CREATE TYPE "NormalizedEmailEvent" AS ENUM ('ACCEPTED', 'DELIVERED', 'BOUNCED_HARD', 'BOUNCED_SOFT', 'BLOCKED', 'COMPLAINT', 'UNSUBSCRIBED', 'FAILED');

-- AlterTable
ALTER TABLE "communication_contacts" ADD COLUMN     "unsubscribeToken" TEXT;

-- CreateTable
CREATE TABLE "communication_email_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectDefault" TEXT,
    "preheaderDefault" TEXT,
    "designJson" JSONB NOT NULL,
    "compiledHtml" TEXT NOT NULL,
    "compiledText" TEXT NOT NULL,
    "status" "CommunicationEmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_email_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CommunicationEmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" UUID,
    "subjectSnapshot" TEXT,
    "preheaderSnapshot" TEXT,
    "htmlSnapshot" TEXT,
    "textSnapshot" TEXT,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "audienceConfig" JSONB NOT NULL,
    "eligibleRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "excludedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_email_campaign_recipients" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "firstNameSnapshot" TEXT,
    "lastNameSnapshot" TEXT,
    "organizationNameSnapshot" TEXT,
    "exclusionReason" TEXT,
    "deliveryStatus" "CommunicationEmailRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "internalMessageId" TEXT NOT NULL,
    "threadToken" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "conversationId" UUID,
    "messageId" UUID,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessageSafe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_email_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_email_events" (
    "id" UUID NOT NULL,
    "recipientId" UUID,
    "providerMessageId" TEXT,
    "normalizedType" "NormalizedEmailEvent" NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_email_templates_status_idx" ON "communication_email_templates"("status");

-- CreateIndex
CREATE INDEX "communication_email_campaigns_status_idx" ON "communication_email_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "communication_email_campaign_recipients_internalMessageId_key" ON "communication_email_campaign_recipients"("internalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_email_campaign_recipients_threadToken_key" ON "communication_email_campaign_recipients"("threadToken");

-- CreateIndex
CREATE INDEX "communication_email_campaign_recipients_campaignId_delivery_idx" ON "communication_email_campaign_recipients"("campaignId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "communication_email_campaign_recipients_deliveryStatus_idx" ON "communication_email_campaign_recipients"("deliveryStatus");

-- CreateIndex
CREATE INDEX "communication_email_campaign_recipients_providerMessageId_idx" ON "communication_email_campaign_recipients"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_email_events_dedupKey_key" ON "communication_email_events"("dedupKey");

-- CreateIndex
CREATE INDEX "communication_email_events_providerMessageId_idx" ON "communication_email_events"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_contacts_unsubscribeToken_key" ON "communication_contacts"("unsubscribeToken");

-- AddForeignKey
ALTER TABLE "communication_email_campaigns" ADD CONSTRAINT "communication_email_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "communication_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_email_campaign_recipients" ADD CONSTRAINT "communication_email_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "communication_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

