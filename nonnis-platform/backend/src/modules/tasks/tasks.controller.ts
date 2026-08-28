import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { TasksService, type EligibleAssignee } from "./tasks.service";
import type { CaseTaskView } from "./tasks.serializer";
import { CancelTaskDto, CreateTaskDto, ListTasksDto, UpdateTaskDto } from "./dto/tasks.dto";

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get("cases/:caseId/tasks")
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  listForCase(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Query() query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    return this.tasks.listForCase(user, caseId, query);
  }

  @Post("cases/:caseId/tasks")
  @RequirePermissions(PERMISSIONS.TASKS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Body() dto: CreateTaskDto): Promise<CaseTaskView> {
    return this.tasks.create(user, caseId, dto);
  }

  @Get("cases/:caseId/task-assignees")
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  assignees(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string): Promise<EligibleAssignee[]> {
    return this.tasks.eligibleAssignees(user, caseId);
  }

  @Get("tasks")
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  myTasks(@CurrentUser() user: RequestUser, @Query() query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    return this.tasks.myTasks(user, query);
  }

  @Get("operations/tasks")
  @RequirePermissions(PERMISSIONS.TASKS_READ_ALL)
  operations(@Query() query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    return this.tasks.operationsList(query);
  }

  @Get("tasks/:id")
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<CaseTaskView> {
    return this.tasks.findOne(user, id);
  }

  @Patch("tasks/:id")
  @RequirePermissions(PERMISSIONS.TASKS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateTaskDto): Promise<CaseTaskView> {
    return this.tasks.update(user, id, dto);
  }

  @Post("tasks/:id/start")
  @RequirePermissions(PERMISSIONS.TASKS_MANAGE)
  start(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<CaseTaskView> {
    return this.tasks.transition(user, id, "IN_PROGRESS", "TASK_STARTED");
  }

  @Post("tasks/:id/complete")
  @RequirePermissions(PERMISSIONS.TASKS_MANAGE)
  complete(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<CaseTaskView> {
    return this.tasks.transition(user, id, "COMPLETED", "TASK_COMPLETED");
  }

  @Post("tasks/:id/cancel")
  @RequirePermissions(PERMISSIONS.TASKS_MANAGE)
  cancel(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CancelTaskDto): Promise<CaseTaskView> {
    return this.tasks.cancel(user, id, dto);
  }
}
