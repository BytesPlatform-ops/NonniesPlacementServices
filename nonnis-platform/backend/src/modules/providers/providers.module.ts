import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContentModule } from "../content/content.module";
import { ProviderAccessService } from "./provider-access";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { PublicProvidersController } from "./public-providers.controller";
import { PublicProvidersService } from "./public-providers.service";
import { ProviderServicesService } from "./provider-services.service";
import { ProviderCoverageService } from "./provider-coverage.service";
import { ProviderAttributesService } from "./provider-attributes.service";
import { ProviderCapacityService } from "./provider-capacity.service";
import {
  ProviderAttributesController,
  ProviderCapacityController,
  ProviderCoverageController,
  ProviderServicesController,
} from "./provider-subresources.controller";

@Module({
  imports: [AuditModule, ContentModule],
  controllers: [
    ProvidersController,
    PublicProvidersController,
    ProviderServicesController,
    ProviderCoverageController,
    ProviderAttributesController,
    ProviderCapacityController,
  ],
  providers: [
    ProviderAccessService,
    ProvidersService,
    PublicProvidersService,
    ProviderServicesService,
    ProviderCoverageService,
    ProviderAttributesService,
    ProviderCapacityService,
  ],
  exports: [ProvidersService],
})
export class ProvidersModule {}
