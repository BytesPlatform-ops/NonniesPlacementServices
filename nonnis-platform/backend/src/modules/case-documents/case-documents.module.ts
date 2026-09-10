import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { CaseDocumentsController } from "./case-documents.controller";
import { CaseDocumentsService } from "./case-documents.service";

@Module({
  imports: [WorkflowEventsModule, StorageModule],
  controllers: [CaseDocumentsController],
  providers: [CaseDocumentsService],
  exports: [CaseDocumentsService],
})
export class CaseDocumentsModule {}
