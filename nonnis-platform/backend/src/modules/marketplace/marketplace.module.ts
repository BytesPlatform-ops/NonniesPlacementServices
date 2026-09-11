import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContentModule } from "../content/content.module";
import { MarketplaceAccessService } from "./marketplace-access";
import { MarketplaceListingsService } from "./listings.service";
import { MarketplaceOrdersService } from "./orders.service";
import {
  MarketplaceAdminController,
  ProviderListingsController,
  ProviderMarketplaceOrdersController,
  SeekerMarketplaceController,
} from "./marketplace.controller";

/**
 * Marketplace: provider-listed beds, rooms and units bought or rented directly
 * by families. A parallel domain to referrals — it shares the Provider record
 * and nothing else, and never touches Case, ServiceRequest, Referral,
 * Placement or ProviderCapacity.
 */
@Module({
  imports: [AuditModule, ContentModule],
  controllers: [
    ProviderListingsController,
    ProviderMarketplaceOrdersController,
    SeekerMarketplaceController,
    MarketplaceAdminController,
  ],
  providers: [MarketplaceAccessService, MarketplaceListingsService, MarketplaceOrdersService],
})
export class MarketplaceModule {}
