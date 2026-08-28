-- Provider directory foundation (additive, non-destructive).
--
-- The existing `ServiceCategory` enum is RENAMED (not dropped) so the new
-- admin-managed `service_categories` model can own the `ServiceCategory` name.
-- Renaming preserves the `service_requests.category` column and all its data.

-- RenameEnum: preserves existing service_requests.category values.
ALTER TYPE "ServiceCategory" RENAME TO "ServiceCategoryCode";

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CoverageType" AS ENUM ('CITY', 'COUNTY', 'STATE', 'POSTAL_CODE', 'RADIUS');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "CapacityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN');

-- AlterTable: additive forward-looking link; existing `category` enum column is untouched.
ALTER TABLE "service_requests" ADD COLUMN "serviceCategoryId" UUID;

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "timezone" TEXT,
    "eligibilityNotes" TEXT,
    "internalNotes" TEXT,
    "licenseNumber" TEXT,
    "licenseType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_services" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "serviceCategoryId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "levelOfCare" "LevelOfCare",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_coverage_areas" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "coverageType" "CoverageType" NOT NULL DEFAULT 'CITY',
    "city" TEXT,
    "county" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "radiusMiles" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_coverage_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_payment_types" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "paymentTypeId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_payment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_languages" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "languageId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_hours" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "open24" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_capacity" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "serviceCategoryId" UUID,
    "status" "CapacityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "availableCount" INTEGER,
    "effectiveDate" DATE,
    "notes" TEXT,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_organizationId_key" ON "providers"("organizationId");

-- CreateIndex
CREATE INDEX "providers_status_idx" ON "providers"("status");

-- CreateIndex
CREATE INDEX "providers_state_idx" ON "providers"("state");

-- CreateIndex
CREATE INDEX "providers_city_idx" ON "providers"("city");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");

-- CreateIndex
CREATE INDEX "service_categories_active_idx" ON "service_categories"("active");

-- CreateIndex
CREATE INDEX "provider_services_providerId_idx" ON "provider_services"("providerId");

-- CreateIndex
CREATE INDEX "provider_services_serviceCategoryId_idx" ON "provider_services"("serviceCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_services_providerId_serviceCategoryId_key" ON "provider_services"("providerId", "serviceCategoryId");

-- CreateIndex
CREATE INDEX "provider_coverage_areas_providerId_idx" ON "provider_coverage_areas"("providerId");

-- CreateIndex
CREATE INDEX "provider_coverage_areas_state_idx" ON "provider_coverage_areas"("state");

-- CreateIndex
CREATE INDEX "provider_coverage_areas_city_idx" ON "provider_coverage_areas"("city");

-- CreateIndex
CREATE INDEX "provider_coverage_areas_postalCode_idx" ON "provider_coverage_areas"("postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "payment_types_code_key" ON "payment_types"("code");

-- CreateIndex
CREATE INDEX "payment_types_active_idx" ON "payment_types"("active");

-- CreateIndex
CREATE INDEX "provider_payment_types_providerId_idx" ON "provider_payment_types"("providerId");

-- CreateIndex
CREATE INDEX "provider_payment_types_paymentTypeId_idx" ON "provider_payment_types"("paymentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_payment_types_providerId_paymentTypeId_key" ON "provider_payment_types"("providerId", "paymentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE INDEX "languages_active_idx" ON "languages"("active");

-- CreateIndex
CREATE INDEX "provider_languages_providerId_idx" ON "provider_languages"("providerId");

-- CreateIndex
CREATE INDEX "provider_languages_languageId_idx" ON "provider_languages"("languageId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_languages_providerId_languageId_key" ON "provider_languages"("providerId", "languageId");

-- CreateIndex
CREATE INDEX "provider_hours_providerId_idx" ON "provider_hours"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_hours_providerId_dayOfWeek_key" ON "provider_hours"("providerId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "provider_capacity_providerId_idx" ON "provider_capacity"("providerId");

-- CreateIndex
CREATE INDEX "provider_capacity_status_idx" ON "provider_capacity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_capacity_providerId_serviceCategoryId_key" ON "provider_capacity"("providerId", "serviceCategoryId");

-- CreateIndex
CREATE INDEX "service_requests_serviceCategoryId_idx" ON "service_requests"("serviceCategoryId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_coverage_areas" ADD CONSTRAINT "provider_coverage_areas_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payment_types" ADD CONSTRAINT "provider_payment_types_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payment_types" ADD CONSTRAINT "provider_payment_types_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "payment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_languages" ADD CONSTRAINT "provider_languages_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_languages" ADD CONSTRAINT "provider_languages_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_hours" ADD CONSTRAINT "provider_hours_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_capacity" ADD CONSTRAINT "provider_capacity_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_capacity" ADD CONSTRAINT "provider_capacity_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_capacity" ADD CONSTRAINT "provider_capacity_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
