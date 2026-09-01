-- Public residential directory listing fields (additive; all default OFF).
ALTER TABLE "providers"
  ADD COLUMN "isResidentialProvider" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicSlug" TEXT,
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "publicFeaturedImageUrl" TEXT,
  ADD COLUMN "publicFeaturedImageStoragePath" TEXT,
  ADD COLUMN "publicSortOrder" INTEGER,
  ADD COLUMN "publicPublishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "providers_publicSlug_key" ON "providers"("publicSlug");
CREATE INDEX "providers_publicListingEnabled_idx" ON "providers"("publicListingEnabled");
