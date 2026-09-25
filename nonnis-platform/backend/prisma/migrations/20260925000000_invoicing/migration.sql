-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SENT', 'PENDING_PAYMENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REQUIRES_VERIFICATION');

-- CreateEnum
CREATE TYPE "InvoiceBillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('STRIPE', 'ZELLE', 'CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "InvoiceRecurringInterval" AS ENUM ('MONTHLY');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('PLATFORM_SUBSCRIPTION', 'PLACEMENT_SERVICE');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED', 'REQUIRES_VERIFICATION');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "providerId" UUID NOT NULL,
    "caseId" UUID,
    "orderId" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "billingType" "InvoiceBillingType" NOT NULL DEFAULT 'ONE_TIME',
    "paymentMethod" "InvoicePaymentMethod" NOT NULL DEFAULT 'STRIPE',
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "recurringInterval" "InvoiceRecurringInterval",
    "recurringPeriods" INTEGER,
    "recurringStartAt" TIMESTAMP(3),
    "recurringEndsAt" TIMESTAMP(3),
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "subscriptionId" UUID,
    "periodStart" DATE,
    "periodEnd" DATE,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "productId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "InvoicePaymentMethod" NOT NULL,
    "status" "InvoicePaymentStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripePaymentIntentId" TEXT,
    "reference" TEXT,
    "verifiedByUserId" UUID,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "InvoiceStatus",
    "toStatus" "InvoiceStatus",
    "message" TEXT,
    "actorUserId" UUID,
    "actorRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suggestedUnitPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_subscriptions" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "periodsBilled" INTEGER NOT NULL DEFAULT 0,
    "totalPeriods" INTEGER,
    "nextBillingDate" DATE,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeCheckoutSessionId_key" ON "invoices"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripePaymentIntentId_key" ON "invoices"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeSubscriptionId_key" ON "invoices"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "invoices_providerId_status_idx" ON "invoices"("providerId", "status");

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_subscriptionId_periodStart_key" ON "invoices"("subscriptionId", "periodStart");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_stripePaymentIntentId_key" ON "invoice_payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_status_idx" ON "invoice_payments"("status");

-- CreateIndex
CREATE INDEX "invoice_events_invoiceId_createdAt_idx" ON "invoice_events"("invoiceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_category_active_idx" ON "products"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "provider_subscriptions_stripeSubscriptionId_key" ON "provider_subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "provider_subscriptions_providerId_status_idx" ON "provider_subscriptions"("providerId", "status");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "provider_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

