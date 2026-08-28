import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { TaskAccessService } from "./task-access";

@Module({
  imports: [WorkflowEventsModule, AuditModule],
  controllers: [TasksController],
  providers: [TasksService, TaskAccessService],
})
export class TasksModule {}
