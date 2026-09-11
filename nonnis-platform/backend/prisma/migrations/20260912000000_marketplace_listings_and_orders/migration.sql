-- CreateEnum
CREATE TYPE "MarketplaceListingType" AS ENUM ('BED', 'PRIVATE_ROOM', 'SHARED_ROOM', 'UNIT', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceTransactionType" AS ENUM ('RENT', 'SALE');

-- CreateEnum
CREATE TYPE "MarketplaceBillingPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNAVAILABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketplacePaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'INVOICE');

-- CreateEnum
CREATE TYPE "MarketplacePaymentStatus" AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "provider_listings" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "listingType" "MarketplaceListingType" NOT NULL DEFAULT 'BED',
    "transactionType" "MarketplaceTransactionType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingPeriod" "MarketplaceBillingPeriod",
    "depositAmount" DECIMAL(12,2),
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "availableFrom" DATE,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceCategoryId" UUID,
    "restrictions" TEXT,
    "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_listing_images" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "seekerUserId" UUID NOT NULL,
    "caseId" UUID,
    "transactionType" "MarketplaceTransactionType" NOT NULL,
    "listingTitle" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "billingPeriod" "MarketplaceBillingPeriod",
    "requestedStartDate" DATE,
    "requestedEndDate" DATE,
    "paymentMethod" "MarketplacePaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "MarketplacePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "seekerNote" TEXT,
    "declineReason" TEXT,
    "quantityReleasedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByUserId" UUID,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_listings_providerId_idx" ON "provider_listings"("providerId");

-- CreateIndex
CREATE INDEX "provider_listings_status_idx" ON "provider_listings"("status");

-- CreateIndex
CREATE INDEX "provider_listings_transactionType_idx" ON "provider_listings"("transactionType");

-- CreateIndex
CREATE INDEX "provider_listing_images_listingId_sortOrder_idx" ON "provider_listing_images"("listingId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_orderNumber_key" ON "marketplace_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "marketplace_orders_providerId_status_idx" ON "marketplace_orders"("providerId", "status");

-- CreateIndex
CREATE INDEX "marketplace_orders_seekerUserId_idx" ON "marketplace_orders"("seekerUserId");

-- CreateIndex
CREATE INDEX "marketplace_orders_listingId_idx" ON "marketplace_orders"("listingId");

-- AddForeignKey
ALTER TABLE "provider_listings" ADD CONSTRAINT "provider_listings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_listings" ADD CONSTRAINT "provider_listings_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_listing_images" ADD CONSTRAINT "provider_listing_images_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "provider_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "provider_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

