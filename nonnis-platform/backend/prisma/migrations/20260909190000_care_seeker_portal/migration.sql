-- CreateEnum
CREATE TYPE "CareSeekerAccessStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "CaseDocumentStatus" AS ENUM ('REQUESTED', 'UPLOADED', 'ACCEPTED', 'NEEDS_UPDATE');

-- CreateEnum
CREATE TYPE "CaseDocumentVisibility" AS ENUM ('CASE_TEAM', 'CARE_SEEKER');

-- CreateEnum
CREATE TYPE "CaseAppointmentType" AS ENUM ('TOUR', 'ASSESSMENT', 'MEETING', 'MOVE_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseAppointmentStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MessageScope" ADD VALUE 'CARE_SEEKER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowEventType" ADD VALUE 'CARE_SEEKER_ACCESS_GRANTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CARE_SEEKER_ACCESS_REVOKED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CARE_SEEKER_MESSAGE_SENT';
ALTER TYPE "WorkflowEventType" ADD VALUE 'DOCUMENT_REQUESTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'DOCUMENT_ACCEPTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'DOCUMENT_UPDATE_REQUESTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'APPOINTMENT_REQUESTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'APPOINTMENT_SCHEDULED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'APPOINTMENT_RESCHEDULE_REQUESTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'APPOINTMENT_COMPLETED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'APPOINTMENT_CANCELLED';

-- CreateTable
CREATE TABLE "care_seeker_case_access" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "CareSeekerAccessStatus" NOT NULL DEFAULT 'INVITED',
    "relationship" TEXT,
    "grantedByUserId" UUID,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_seeker_case_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_documents" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseDocumentStatus" NOT NULL DEFAULT 'REQUESTED',
    "visibility" "CaseDocumentVisibility" NOT NULL DEFAULT 'CASE_TEAM',
    "requestedFromSeeker" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT,
    "requestedByUserId" UUID,
    "uploadedByUserId" UUID,
    "uploadedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_appointments" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "providerId" UUID,
    "referralId" UUID,
    "type" "CaseAppointmentType" NOT NULL DEFAULT 'TOUR',
    "status" "CaseAppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "locationText" TEXT,
    "instructions" TEXT,
    "seekerNote" TEXT,
    "outcomeNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "requestedByUserId" UUID,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_seeker_case_access_caseId_idx" ON "care_seeker_case_access"("caseId");

-- CreateIndex
CREATE INDEX "care_seeker_case_access_userId_idx" ON "care_seeker_case_access"("userId");

-- CreateIndex
CREATE INDEX "care_seeker_case_access_status_idx" ON "care_seeker_case_access"("status");

-- CreateIndex
CREATE UNIQUE INDEX "care_seeker_case_access_userId_caseId_key" ON "care_seeker_case_access"("userId", "caseId");

-- CreateIndex
CREATE INDEX "case_documents_caseId_idx" ON "case_documents"("caseId");

-- CreateIndex
CREATE INDEX "case_documents_status_idx" ON "case_documents"("status");

-- CreateIndex
CREATE INDEX "case_documents_visibility_idx" ON "case_documents"("visibility");

-- CreateIndex
CREATE INDEX "case_appointments_caseId_idx" ON "case_appointments"("caseId");

-- CreateIndex
CREATE INDEX "case_appointments_providerId_idx" ON "case_appointments"("providerId");

-- CreateIndex
CREATE INDEX "case_appointments_referralId_idx" ON "case_appointments"("referralId");

-- CreateIndex
CREATE INDEX "case_appointments_status_idx" ON "case_appointments"("status");

-- CreateIndex
CREATE INDEX "case_appointments_scheduledAt_idx" ON "case_appointments"("scheduledAt");

-- AddForeignKey
ALTER TABLE "care_seeker_case_access" ADD CONSTRAINT "care_seeker_case_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_seeker_case_access" ADD CONSTRAINT "care_seeker_case_access_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_seeker_case_access" ADD CONSTRAINT "care_seeker_case_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_seeker_case_access" ADD CONSTRAINT "care_seeker_case_access_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_appointments" ADD CONSTRAINT "case_appointments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_appointments" ADD CONSTRAINT "case_appointments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_appointments" ADD CONSTRAINT "case_appointments_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

