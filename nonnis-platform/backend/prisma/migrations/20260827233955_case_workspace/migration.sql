-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'NOT_REQUIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowEventType" ADD VALUE 'CASE_ASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CASE_REASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'CASE_UNASSIGNED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REQUIREMENT_UPDATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'REQUIREMENT_STATUS_CHANGED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'SERVICE_REQUEST_UPDATED';
ALTER TYPE "WorkflowEventType" ADD VALUE 'SERVICE_REQUEST_REMOVED';

-- AlterTable
ALTER TABLE "case_requirements" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedByUserId" UUID,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "RequirementStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patientContactPhone" TEXT,
ADD COLUMN     "representativeContact" TEXT,
ADD COLUMN     "representativeName" TEXT,
ADD COLUMN     "representativeRelationship" TEXT;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "equipmentNeeds" TEXT,
ADD COLUMN     "mandatoryLanguage" TEXT,
ADD COLUMN     "requiredQualifications" TEXT,
ADD COLUMN     "transportationRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "case_requirements_status_idx" ON "case_requirements"("status");

-- AddForeignKey
ALTER TABLE "case_requirements" ADD CONSTRAINT "case_requirements_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

