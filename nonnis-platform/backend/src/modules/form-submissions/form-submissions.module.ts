import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { FormSubmissionsController } from "./form-submissions.controller";
import { FormSubmissionsService } from "./form-submissions.service";
import { IngestTokenGuard } from "./ingest-token.guard";

@Module({
  imports: [AuditModule],
  controllers: [FormSubmissionsController],
  providers: [FormSubmissionsService, IngestTokenGuard],
})
export class FormSubmissionsModule {}
