import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ReferenceController } from "./reference.controller";
import { ReferenceService } from "./reference.service";
import { ServiceCategoriesController } from "./service-categories.controller";
import { ServiceCategoriesService } from "./service-categories.service";

@Module({
  imports: [AuditModule],
  controllers: [ServiceCategoriesController, ReferenceController],
  providers: [ServiceCategoriesService, ReferenceService],
  exports: [ServiceCategoriesService, ReferenceService],
})
export class CatalogModule {}
