-- AlterEnum
ALTER TYPE "MarketplacePaymentMethod" ADD VALUE 'STRIPE';

-- AlterTable
ALTER TABLE "marketplace_orders" ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "stripePaymentStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_stripeCheckoutSessionId_key" ON "marketplace_orders"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_stripePaymentIntentId_key" ON "marketplace_orders"("stripePaymentIntentId");
