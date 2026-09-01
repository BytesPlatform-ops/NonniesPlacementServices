-- CreateEnum
CREATE TYPE "CommunicationContactSource" AS ENUM ('MANUAL', 'PASTE_IMPORT', 'CSV_IMPORT', 'TXT_IMPORT');

-- CreateEnum
CREATE TYPE "CommunicationContactStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CommunicationConsentStatus" AS ENUM ('UNKNOWN', 'OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "CommunicationSuppressionReason" AS ENUM ('USER_OPT_OUT', 'ADMIN_BLOCK', 'HARD_BOUNCE', 'SPAM_COMPLAINT', 'INVALID_ADDRESS');

-- CreateEnum
CREATE TYPE "CommunicationConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommunicationMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CommunicationMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateTable
CREATE TABLE "communication_contacts" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "normalizedPhoneE164" TEXT,
    "organizationName" TEXT,
    "source" "CommunicationContactSource" NOT NULL DEFAULT 'MANUAL',
    "status" "CommunicationContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_channel_preferences" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "consentStatus" "CommunicationConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consentSource" TEXT,
    "consentAt" TIMESTAMP(3),
    "optOutAt" TIMESTAMP(3),
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_channel_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_lists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_list_members" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "addedByUserId" UUID,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_contact_tags" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_suppressions" (
    "id" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "reason" "CommunicationSuppressionReason" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_import_batches" (
    "id" UUID NOT NULL,
    "sourceType" "CommunicationContactSource" NOT NULL,
    "originalFilename" TEXT,
    "totalRows" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "suppressedCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_conversations" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "CommunicationConversationStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationMessageDirection" NOT NULL,
    "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_contacts_normalizedEmail_key" ON "communication_contacts"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "communication_contacts_normalizedPhoneE164_key" ON "communication_contacts"("normalizedPhoneE164");

-- CreateIndex
CREATE INDEX "communication_contacts_status_idx" ON "communication_contacts"("status");

-- CreateIndex
CREATE INDEX "communication_contacts_organizationName_idx" ON "communication_contacts"("organizationName");

-- CreateIndex
CREATE INDEX "contact_channel_preferences_channel_consentStatus_idx" ON "contact_channel_preferences"("channel", "consentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "contact_channel_preferences_contactId_channel_key" ON "contact_channel_preferences"("contactId", "channel");

-- CreateIndex
CREATE INDEX "communication_lists_active_idx" ON "communication_lists"("active");

-- CreateIndex
CREATE INDEX "communication_list_members_contactId_idx" ON "communication_list_members"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_list_members_listId_contactId_key" ON "communication_list_members"("listId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_tags_name_key" ON "communication_tags"("name");

-- CreateIndex
CREATE INDEX "communication_contact_tags_tagId_idx" ON "communication_contact_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_contact_tags_contactId_tagId_key" ON "communication_contact_tags"("contactId", "tagId");

-- CreateIndex
CREATE INDEX "communication_suppressions_active_idx" ON "communication_suppressions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "communication_suppressions_channel_normalizedAddress_key" ON "communication_suppressions"("channel", "normalizedAddress");

-- CreateIndex
CREATE INDEX "communication_import_batches_createdAt_idx" ON "communication_import_batches"("createdAt");

-- CreateIndex
CREATE INDEX "communication_conversations_contactId_idx" ON "communication_conversations"("contactId");

-- CreateIndex
CREATE INDEX "communication_conversations_channel_status_idx" ON "communication_conversations"("channel", "status");

-- CreateIndex
CREATE INDEX "communication_messages_conversationId_idx" ON "communication_messages"("conversationId");

-- AddForeignKey
ALTER TABLE "contact_channel_preferences" ADD CONSTRAINT "contact_channel_preferences_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "communication_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_list_members" ADD CONSTRAINT "communication_list_members_listId_fkey" FOREIGN KEY ("listId") REFERENCES "communication_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_list_members" ADD CONSTRAINT "communication_list_members_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "communication_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_contact_tags" ADD CONSTRAINT "communication_contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "communication_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_contact_tags" ADD CONSTRAINT "communication_contact_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "communication_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "communication_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

