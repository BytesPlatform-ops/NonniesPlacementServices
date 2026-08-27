-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('NONNIS', 'HOSPITAL', 'REHABILITATION_CENTER', 'SKILLED_NURSING_FACILITY', 'PROVIDER', 'PARTNER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'MATCHING', 'REFERRAL_SENT', 'PROVIDER_REVIEWING', 'ADDITIONAL_INFORMATION_REQUIRED', 'ACCEPTED', 'DECLINED', 'SERVICES_BEING_COORDINATED', 'READY_FOR_DISCHARGE', 'DISCHARGED', 'SERVICE_STARTED', 'FOLLOW_UP_REQUIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CareSetting" AS ENUM ('HOSPITAL', 'REHABILITATION_CENTER', 'SKILLED_NURSING_FACILITY', 'EMERGENCY_DEPARTMENT', 'HOME', 'ASSISTED_LIVING', 'MEMORY_CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('HOME_HEALTH', 'SKILLED_NURSING', 'PHYSICAL_THERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'PERSONAL_CARE', 'HOMEMAKER', 'HOSPICE', 'PALLIATIVE_CARE', 'INFUSION', 'WOUND_CARE', 'BEHAVIORAL_HEALTH', 'DURABLE_MEDICAL_EQUIPMENT', 'TRANSPORTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LevelOfCare" AS ENUM ('INDEPENDENT', 'SUPPORTIVE', 'INTERMEDIATE', 'SKILLED', 'COMPLEX');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'MATCHING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('CLINICAL', 'NONCLINICAL', 'EQUIPMENT', 'TRANSPORTATION', 'PROVIDER_QUALIFICATION', 'INSURANCE_FUNDING', 'SPECIAL_CIRCUMSTANCE', 'PREFERENCE');

-- CreateEnum
CREATE TYPE "WorkflowEventType" AS ENUM ('CASE_CREATED', 'CASE_UPDATED', 'STATUS_CHANGED', 'REQUIREMENT_ADDED', 'SERVICE_REQUEST_ADDED', 'NOTE_ADDED', 'CASE_CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowEventSource" AS ENUM ('MANUAL', 'AUTOMATED', 'SYSTEM');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "externalRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "externalRef" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "phone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "externalRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "externalCaseId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "originatingFacilityId" UUID NOT NULL,
    "dischargeProfessionalRef" TEXT,
    "expectedDischargeDate" TIMESTAMP(3),
    "actualDischargeDate" TIMESTAMP(3),
    "currentCareSetting" "CareSetting",
    "preferredServiceLocation" TEXT,
    "primaryLanguage" TEXT,
    "interpreterRequired" BOOLEAN NOT NULL DEFAULT false,
    "communicationPreference" TEXT,
    "accessibilityNeeds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "category" "ServiceCategory" NOT NULL,
    "levelOfCare" "LevelOfCare",
    "requestedStartDate" TIMESTAMP(3),
    "frequency" TEXT,
    "durationText" TEXT,
    "serviceCity" TEXT,
    "serviceState" TEXT,
    "servicePostalCode" TEXT,
    "serviceRadiusMiles" INTEGER,
    "fundingSource" TEXT,
    "insurancePlan" TEXT,
    "authorizationReference" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_requirements" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "serviceRequestId" UUID,
    "category" "RequirementCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "WorkflowEventType" NOT NULL,
    "previousStatus" "CaseStatus",
    "newStatus" "CaseStatus",
    "actorRef" TEXT,
    "source" "WorkflowEventSource" NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorRef" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "facilities_organizationId_idx" ON "facilities"("organizationId");

-- CreateIndex
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "cases_caseNumber_key" ON "cases"("caseNumber");

-- CreateIndex
CREATE INDEX "cases_organizationId_idx" ON "cases"("organizationId");

-- CreateIndex
CREATE INDEX "cases_patientId_idx" ON "cases"("patientId");

-- CreateIndex
CREATE INDEX "cases_originatingFacilityId_idx" ON "cases"("originatingFacilityId");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_updatedAt_idx" ON "cases"("updatedAt");

-- CreateIndex
CREATE INDEX "service_requests_caseId_idx" ON "service_requests"("caseId");

-- CreateIndex
CREATE INDEX "service_requests_category_idx" ON "service_requests"("category");

-- CreateIndex
CREATE INDEX "case_requirements_caseId_idx" ON "case_requirements"("caseId");

-- CreateIndex
CREATE INDEX "case_requirements_serviceRequestId_idx" ON "case_requirements"("serviceRequestId");

-- CreateIndex
CREATE INDEX "case_requirements_category_idx" ON "case_requirements"("category");

-- CreateIndex
CREATE INDEX "workflow_events_caseId_idx" ON "workflow_events"("caseId");

-- CreateIndex
CREATE INDEX "workflow_events_organizationId_idx" ON "workflow_events"("organizationId");

-- CreateIndex
CREATE INDEX "workflow_events_type_idx" ON "workflow_events"("type");

-- CreateIndex
CREATE INDEX "workflow_events_createdAt_idx" ON "workflow_events"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_idx" ON "audit_events"("organizationId");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_originatingFacilityId_fkey" FOREIGN KEY ("originatingFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_requirements" ADD CONSTRAINT "case_requirements_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_requirements" ADD CONSTRAINT "case_requirements_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

