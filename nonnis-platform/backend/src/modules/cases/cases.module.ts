import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";

@Module({
  imports: [WorkflowEventsModule, AuditModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
