import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, Public, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { FormSubmissionsService, type IngestResult } from "./form-submissions.service";
import { SubmissionAttachmentsService } from "./submission-attachments.service";
import { IngestTokenGuard } from "./ingest-token.guard";
import type { FormSubmissionDetail, FormSubmissionSummary } from "./form-submissions.serializer";
import {
  IngestFormSubmissionDto,
  ListFormSubmissionsDto,
  UpdateFormSubmissionDto,
} from "./dto/form-submissions.dto";

@Controller("form-submissions")
export class FormSubmissionsController {
  constructor(
    private readonly submissions: FormSubmissionsService,
    private readonly attachments: SubmissionAttachmentsService,
  ) {}

  /** Server-to-server ingest from the public website (token-guarded, not user auth). */
  @Post("ingest")
  @Public()
  @UseGuards(IngestTokenGuard)
  ingest(@Body() dto: IngestFormSubmissionDto): Promise<IngestResult> {
    return this.submissions.ingest(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FORM_SUBMISSIONS_READ)
  list(@Query() query: ListFormSubmissionsDto): Promise<PaginatedResult<FormSubmissionSummary>> {
    return this.submissions.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.FORM_SUBMISSIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<FormSubmissionDetail> {
    return this.submissions.findOne(id);
  }

  @Get(":id/attachments/:attachmentId/download")
  @RequirePermissions(PERMISSIONS.FORM_SUBMISSIONS_READ)
  download(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
  ): Promise<{ url: string; fileName: string }> {
    return this.attachments.downloadUrl(id, attachmentId);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.FORM_SUBMISSIONS_MANAGE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFormSubmissionDto,
  ): Promise<FormSubmissionDetail> {
    return this.submissions.update(user, id, dto);
  }
}
