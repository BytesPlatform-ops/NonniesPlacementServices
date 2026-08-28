import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { ReadinessController } from "./readiness.controller";
import { ReadinessService } from "./readiness.service";

@Module({
  imports: [WorkflowEventsModule, AuditModule],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
