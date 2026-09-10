import { Module } from "@nestjs/common";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { CaseAppointmentsController } from "./case-appointments.controller";
import { CaseAppointmentsService } from "./case-appointments.service";

@Module({
  imports: [WorkflowEventsModule],
  controllers: [CaseAppointmentsController],
  providers: [CaseAppointmentsService],
  exports: [CaseAppointmentsService],
})
export class CaseAppointmentsModule {}
