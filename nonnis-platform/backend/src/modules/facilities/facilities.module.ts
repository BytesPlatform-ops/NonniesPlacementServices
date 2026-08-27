import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { FacilitiesController } from "./facilities.controller";
import { FacilitiesService } from "./facilities.service";

@Module({
  imports: [AuditModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
