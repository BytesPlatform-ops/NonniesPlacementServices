-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CoverageType" ADD VALUE 'COUNTRY';
ALTER TYPE "CoverageType" ADD VALUE 'ADDRESS';

-- AlterTable
ALTER TABLE "provider_coverage_areas" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "postalCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "street" TEXT;


-- Backfill the new list from the legacy single code, so `postalCodes` is the
-- one authoritative set from here on and no row has to be read two ways.
-- Touches only the column added immediately above; no existing value changes.
UPDATE "provider_coverage_areas"
SET "postalCodes" = ARRAY["postalCode"]
WHERE "postalCode" IS NOT NULL
  AND "postalCode" <> ''
  AND COALESCE(array_length("postalCodes", 1), 0) = 0;
