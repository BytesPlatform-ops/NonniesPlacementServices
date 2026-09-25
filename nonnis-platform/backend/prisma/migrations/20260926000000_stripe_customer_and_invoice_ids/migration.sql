-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "stripeInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "providers_stripeCustomerId_key" ON "providers"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
