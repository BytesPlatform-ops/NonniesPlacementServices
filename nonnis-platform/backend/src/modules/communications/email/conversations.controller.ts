import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { ConversationService } from "./conversation.service";
import { AttachmentUploadUrlDto, ListConversationsDto, ReplyDto } from "../dto/inbox.dto";

/**
 * Unified inbox conversations. `communications/conversations` is the channel-neutral
 * path used by the CRM; the original email-scoped path is kept as an alias so 15C
 * clients keep working. 15E will consolidate the naming.
 */
@Controller(["communications/conversations", "communications/email/conversations"])
export class ConversationsController {
  constructor(private readonly conversations: ConversationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListConversationsDto) {
    return this.conversations.list(user, { view: query.view, channel: query.channel, search: query.search, page: query.page, pageSize: query.pageSize });
  }

  @Get("unread-count")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.conversations.unreadCount(user).then((count) => ({ count }));
  }

  @Post("attachments/upload-url")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  uploadUrl(@Body() dto: AttachmentUploadUrlDto) {
    return this.conversations.createAttachmentUploadUrl(dto.fileName, dto.mimeType, dto.sizeBytes);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  get(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.conversations.get(user, id);
  }

  @Post(":id/read")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  read(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.conversations.markRead(user, id);
  }

  @Post(":id/mark-unread")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  markUnread(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.conversations.markUnread(user, id);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  archive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.conversations.archive(user, id);
  }

  @Post(":id/restore")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  restore(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.conversations.restore(user, id);
  }

  @Post(":id/reply")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  reply(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ReplyDto) {
    return this.conversations.replyToConversation(user, id, dto.body, dto.attachments ?? []);
  }

  @Post(":id/messages/:messageId/retry")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  retry(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Param("messageId", new ParseUUIDPipe()) messageId: string) {
    return this.conversations.retryReply(user, id, messageId);
  }

  @Get(":id/attachments/:attachmentId/download")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  download(@Param("id", new ParseUUIDPipe()) id: string, @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string) {
    return this.conversations.attachmentDownloadUrl(id, attachmentId);
  }
}
