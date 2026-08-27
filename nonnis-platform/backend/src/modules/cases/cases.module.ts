import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { RequirementsController } from "./requirements/requirements.controller";
import { RequirementsService } from "./requirements/requirements.service";
import { ServiceRequestsController } from "./service-requests/service-requests.controller";
import { ServiceRequestsService } from "./service-requests/service-requests.service";

@Module({
  imports: [WorkflowEventsModule, AuditModule],
  controllers: [CasesController, RequirementsController, ServiceRequestsController],
  providers: [CasesService, RequirementsService, ServiceRequestsService],
  exports: [CasesService],
})
export class CasesModule {}
