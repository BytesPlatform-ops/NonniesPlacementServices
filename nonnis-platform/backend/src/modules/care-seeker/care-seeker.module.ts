import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { CaseAppointmentsModule } from "../case-appointments/case-appointments.module";
import { CaseDocumentsModule } from "../case-documents/case-documents.module";
import { MessagesModule } from "../messages/messages.module";
import { CareSeekerAdminController } from "./care-seeker-admin.controller";
import { CareSeekerAdminService } from "./care-seeker-admin.service";
import { SeekerCaseAccessService } from "./seeker-case-access";
import { SeekerController } from "./seeker.controller";
import { SeekerService } from "./seeker.service";

@Module({
  imports: [WorkflowEventsModule, AuditModule, AuthModule, CaseDocumentsModule, CaseAppointmentsModule, MessagesModule],
  controllers: [SeekerController, CareSeekerAdminController],
  providers: [SeekerService, SeekerCaseAccessService, CareSeekerAdminService],
  exports: [SeekerCaseAccessService],
})
export class CareSeekerModule {}
