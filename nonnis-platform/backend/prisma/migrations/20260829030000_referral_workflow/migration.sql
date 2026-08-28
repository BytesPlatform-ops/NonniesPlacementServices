-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'INFORMATION_REQUESTED', 'CONDITIONALLY_ACCEPTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralResponseType" AS ENUM ('INFORMATION_REQUESTED', 'INFORMATION_PROVIDED', 'CONDITIONALLY_ACCEPTED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ReferralDeclineReason" AS ENUM ('NO_CAPACITY', 'OUTSIDE_COVERAGE', 'SERVICE_NOT_OFFERED', 'FUNDING_NOT_ACCEPTED', 'CLINICAL_NEEDS_UNSUPPORTED', 'START_DATE_UNAVAILABLE', 'ELIGIBILITY_NOT_MET', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferralNotificationStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACCEPTED', 'COORDINATING', 'SCHEDULED', 'STARTED', 'UNSUCCESSFUL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceStartFailureReason" AS ENUM ('PATIENT_UNAVAILABLE', 'PATIENT_DECLINED', 'PROVIDER_UNAVAILABLE', 'AUTHORIZATION_ISSUE', 'SCHEDULE_CHANGED', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowEventType" ADD VALUE 'PROVIDER_SELECTION_STARTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_CREATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_SENT';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_VIEWED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_INFORMATION_REQUESTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_INFORMATION_PROVIDED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_CONDITIONALLY_ACCEPTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_ACCEPTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_DECLINED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_WITHDRAWN';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_NOTIFICATION_SENT';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REFERRAL_NOTIFICATION_FAILED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'PLACEMENT_CREATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'SERVICE_START_SCHEDULED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'SERVICE_STARTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'SERVICE_START_UNSUCCESSFUL';

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "caseId" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedByUserId" UUID,
    "sentByUserId" UUID,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "lastResponseAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" TEXT,
    "assignedProviderUserId" UUID,
    "coordinationNote" TEXT,
    "notificationStatus" "ReferralNotificationStatus" NOT NULL DEFAULT 'NOT_SENT',
    "notificationSentAt" TIMESTAMP(3),
    "notificationLastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_responses" (
    "id" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "type" "ReferralResponseType" NOT NULL,
    "actorUserId" UUID,
    "message" TEXT,
    "declineReason" "ReferralDeclineReason",
    "conditions" TEXT,
    "proposedStartDate" TIMESTAMP(3),
    "fundingConfirmed" BOOLEAN,
    "capacityConfirmed" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placements" (
    "id" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3),
    "scheduledStartAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "unsuccessfulAt" TIMESTAMP(3),
    "unsuccessfulReason" "ServiceStartFailureReason",
    "unsuccessfulNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_reference_key" ON "referrals"("reference");

-- CreateIndex
CREATE INDEX "referrals_caseId_idx" ON "referrals"("caseId");

-- CreateIndex
CREATE INDEX "referrals_serviceRequestId_idx" ON "referrals"("serviceRequestId");

-- CreateIndex
CREATE INDEX "referrals_providerId_idx" ON "referrals"("providerId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "referral_responses_referralId_idx" ON "referral_responses"("referralId");

-- CreateIndex
CREATE UNIQUE INDEX "placements_referralId_key" ON "placements"("referralId");

-- CreateIndex
CREATE INDEX "placements_status_idx" ON "placements"("status");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_responses" ADD CONSTRAINT "referral_responses_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

