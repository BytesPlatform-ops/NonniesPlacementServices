import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { StorageModule } from "../../common/storage/storage.module";
import { FormSubmissionsController } from "./form-submissions.controller";
import { FormSubmissionsService } from "./form-submissions.service";
import { SubmissionAttachmentsService } from "./submission-attachments.service";
import { IngestTokenGuard } from "./ingest-token.guard";

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [FormSubmissionsController],
  providers: [FormSubmissionsService, SubmissionAttachmentsService, IngestTokenGuard],
})
export class FormSubmissionsModule {}
