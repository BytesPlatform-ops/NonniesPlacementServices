-- CreateEnum
CREATE TYPE "CommunicationInboundReviewReason" AS ENUM ('NO_TOKEN', 'UNKNOWN_TOKEN', 'MALFORMED_ADDRESS', 'THREAD_SENDER_MISMATCH', 'HEADER_SENDER_MISMATCH', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "CommunicationInboundReviewStatus" AS ENUM ('PENDING', 'LINKED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "CommunicationConversationStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'BOUNCED';
ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'DELIVERY_UNKNOWN';

-- AlterTable
ALTER TABLE "communication_conversations" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "lastOutboundAt" TIMESTAMP(3),
ADD COLUMN     "latestDirection" "CommunicationMessageDirection",
ADD COLUMN     "originCampaignId" UUID,
ADD COLUMN     "previewText" TEXT,
ADD COLUMN     "threadToken" TEXT;

-- AlterTable
ALTER TABLE "communication_messages" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claimToken" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "fromAddress" TEXT,
ADD COLUMN     "fromName" TEXT,
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "lastErrorMessageSafe" TEXT,
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "previewText" TEXT,
ADD COLUMN     "providerInboundId" TEXT,
ADD COLUMN     "replyToAddress" TEXT,
ADD COLUMN     "toAddress" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "communication_conversation_read_states" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_conversation_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_inbound_email_reviews" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerInboundId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddress" TEXT,
    "subject" TEXT,
    "textBody" TEXT,
    "sanitizedHtmlBody" TEXT,
    "previewText" TEXT,
    "internetMessageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "receivedAt" TIMESTAMP(3),
    "reason" "CommunicationInboundReviewReason" NOT NULL,
    "status" "CommunicationInboundReviewStatus" NOT NULL DEFAULT 'PENDING',
    "linkedConversationId" UUID,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_inbound_email_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_message_attachments" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "providerAttachmentId" TEXT,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_conversation_read_states_userId_idx" ON "communication_conversation_read_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_conversation_read_states_conversationId_userI_key" ON "communication_conversation_read_states"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_inbound_email_reviews_providerInboundId_key" ON "communication_inbound_email_reviews"("providerInboundId");

-- CreateIndex
CREATE INDEX "communication_inbound_email_reviews_status_idx" ON "communication_inbound_email_reviews"("status");

-- CreateIndex
CREATE INDEX "communication_inbound_email_reviews_createdAt_idx" ON "communication_inbound_email_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "communication_message_attachments_messageId_idx" ON "communication_message_attachments"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_conversations_threadToken_key" ON "communication_conversations"("threadToken");

-- CreateIndex
CREATE INDEX "communication_conversations_channel_status_lastMessageAt_idx" ON "communication_conversations"("channel", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "communication_messages_providerInboundId_key" ON "communication_messages"("providerInboundId");

-- CreateIndex
CREATE INDEX "communication_messages_providerMessageId_idx" ON "communication_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "communication_messages_direction_status_idx" ON "communication_messages"("direction", "status");

-- AddForeignKey
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_originCampaignId_fkey" FOREIGN KEY ("originCampaignId") REFERENCES "communication_email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_conversation_read_states" ADD CONSTRAINT "communication_conversation_read_states_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_message_attachments" ADD CONSTRAINT "communication_message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "communication_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

