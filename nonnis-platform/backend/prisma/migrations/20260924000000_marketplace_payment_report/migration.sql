-- AlterEnum
ALTER TYPE "MarketplacePaymentMethod" ADD VALUE 'ZELLE';

-- AlterTable
ALTER TABLE "marketplace_orders" ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentReportedAt" TIMESTAMP(3),
ADD COLUMN     "paymentReportedByUserId" UUID;
