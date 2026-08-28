-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageScope" AS ENUM ('CASE_TEAM', 'NONNIS_INTERNAL', 'PROVIDER_REFERRAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_CREATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_REASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_STARTED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_CANCELLED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'TASK_UPDATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CASE_MESSAGE_SENT';
ALTER TYPE "WorkflowEventType" ADD VALUE 'PROVIDER_MESSAGE_SENT';
ALTER TYPE "WorkflowEventType" ADD VALUE 'INTERNAL_NOTE_ADDED';

-- CreateTable
CREATE TABLE "case_tasks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeUserId" UUID,
    "createdByUserId" UUID NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_messages" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "scope" "MessageScope" NOT NULL,
    "referralId" UUID,
    "senderUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_tasks_caseId_idx" ON "case_tasks"("caseId");

-- CreateIndex
CREATE INDEX "case_tasks_assigneeUserId_idx" ON "case_tasks"("assigneeUserId");

-- CreateIndex
CREATE INDEX "case_tasks_status_idx" ON "case_tasks"("status");

-- CreateIndex
CREATE INDEX "case_tasks_organizationId_idx" ON "case_tasks"("organizationId");

-- CreateIndex
CREATE INDEX "case_messages_caseId_scope_idx" ON "case_messages"("caseId", "scope");

-- CreateIndex
CREATE INDEX "case_messages_referralId_idx" ON "case_messages"("referralId");

-- CreateIndex
CREATE INDEX "case_messages_createdAt_idx" ON "case_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "case_tasks" ADD CONSTRAINT "case_tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

