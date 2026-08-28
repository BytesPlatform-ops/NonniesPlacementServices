import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { ProviderPortalController } from "./provider-portal.controller";
import { ProviderPortalService } from "./provider-portal.service";

@Module({
  imports: [ProvidersModule],
  controllers: [ProviderPortalController],
  providers: [ProviderPortalService],
})
export class ProviderPortalModule {}
