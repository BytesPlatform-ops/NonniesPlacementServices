-- CreateEnum
CREATE TYPE "FormSubmissionFileKind" AS ENUM ('REPORT', 'UPLOAD');

-- CreateTable
CREATE TABLE "website_form_submission_attachments" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "kind" "FormSubmissionFileKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_form_submission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_form_submission_attachments_submissionId_idx" ON "website_form_submission_attachments"("submissionId");

-- AddForeignKey
ALTER TABLE "website_form_submission_attachments" ADD CONSTRAINT "website_form_submission_attachments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "website_form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

