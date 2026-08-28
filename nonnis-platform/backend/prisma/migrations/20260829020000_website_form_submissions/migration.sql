-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "website_form_submissions" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "formName" TEXT NOT NULL,
    "sourcePage" TEXT,
    "submitterName" TEXT,
    "submitterEmail" TEXT,
    "submitterPhone" TEXT,
    "submittedData" JSONB NOT NULL,
    "emailStatus" TEXT,
    "reportGenerated" BOOLEAN NOT NULL DEFAULT false,
    "documentGenerated" BOOLEAN NOT NULL DEFAULT false,
    "attachmentsCount" INTEGER NOT NULL DEFAULT 0,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "relatedCaseId" UUID,
    "relatedProviderId" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_form_submissions_reference_key" ON "website_form_submissions"("reference");

-- CreateIndex
CREATE INDEX "website_form_submissions_formKey_idx" ON "website_form_submissions"("formKey");

-- CreateIndex
CREATE INDEX "website_form_submissions_status_idx" ON "website_form_submissions"("status");

-- CreateIndex
CREATE INDEX "website_form_submissions_submittedAt_idx" ON "website_form_submissions"("submittedAt");

-- CreateIndex
CREATE INDEX "website_form_submissions_submitterEmail_idx" ON "website_form_submissions"("submitterEmail");

