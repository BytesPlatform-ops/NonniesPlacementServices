import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CommunicationsModule } from "../communications/communications.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InvoicesController, ProductsController, ProviderInvoicesController, SubscriptionsController } from "./invoices.controller";
import { InvoicePaymentsController } from "./invoice-payments.controller";
import { InvoicesService } from "./invoices.service";
import { ProductsService } from "./products.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { InvoiceEmailService } from "./invoice-email.service";
import { SubscriptionsService } from "./subscriptions.service";
import { PAYMENT_GATEWAY, UnconfiguredPaymentGateway } from "./payment-gateway";
import { StripePaymentGateway } from "./stripe-payment-gateway";

@Module({
  imports: [AuditModule, CommunicationsModule, NotificationsModule],
  controllers: [InvoicesController, ProviderInvoicesController, ProductsController, SubscriptionsController, InvoicePaymentsController],
  providers: [
    InvoicesService,
    ProductsService,
    InvoicePdfService,
    InvoiceEmailService,
    SubscriptionsService,
    StripePaymentGateway,
    UnconfiguredPaymentGateway,
    // Stripe when a secret key exists, and an honest "unavailable" when it does
    // not. Chosen at boot rather than per call, so the whole app agrees about
    // whether card payment is on — and the invoice system never learns which.
    {
      provide: PAYMENT_GATEWAY,
      inject: [StripePaymentGateway, UnconfiguredPaymentGateway],
      useFactory: (stripe: StripePaymentGateway, unconfigured: UnconfiguredPaymentGateway) =>
        stripe.configured ? stripe : unconfigured,
    },
  ],
  exports: [InvoicesService, ProductsService, SubscriptionsService],
})
export class InvoicesModule {}
