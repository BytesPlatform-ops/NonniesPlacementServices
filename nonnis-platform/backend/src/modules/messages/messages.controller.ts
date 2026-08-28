import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { MessagesService } from "./messages.service";
import type { MessageView } from "./messages.serializer";
import { ListMessagesDto, SendMessageDto } from "./dto/messages.dto";

@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // ---- Case-team ----

  @Get("cases/:caseId/messages")
  @RequirePermissions(PERMISSIONS.MESSAGES_READ)
  listCaseTeam(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Query() query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    return this.messages.listCaseTeam(user, caseId, query);
  }

  @Post("cases/:caseId/messages")
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendCaseTeam(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Body() dto: SendMessageDto): Promise<MessageView> {
    return this.messages.sendCaseTeam(user, caseId, dto);
  }

  // ---- Nonnis internal notes ----

  @Get("cases/:caseId/internal-notes")
  @RequirePermissions(PERMISSIONS.INTERNAL_NOTES_MANAGE)
  listInternal(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Query() query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    return this.messages.listInternal(user, caseId, query);
  }

  @Post("cases/:caseId/internal-notes")
  @RequirePermissions(PERMISSIONS.INTERNAL_NOTES_MANAGE)
  sendInternal(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Body() dto: SendMessageDto): Promise<MessageView> {
    return this.messages.sendInternal(user, caseId, dto);
  }

  // ---- Provider referral thread (staff + provider) ----

  @Get("referrals/:referralId/messages")
  @RequirePermissions(PERMISSIONS.MESSAGES_READ)
  listReferral(@CurrentUser() user: RequestUser, @Param("referralId", new ParseUUIDPipe()) referralId: string, @Query() query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    return this.messages.listReferral(user, referralId, query);
  }

  @Post("referrals/:referralId/messages")
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendReferral(@CurrentUser() user: RequestUser, @Param("referralId", new ParseUUIDPipe()) referralId: string, @Body() dto: SendMessageDto): Promise<MessageView> {
    return this.messages.sendReferral(user, referralId, dto);
  }
}
