import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { EmailDispatcherService } from "./email-dispatcher.service";
import { ConversationService } from "./conversation.service";
import { AttachmentUploadUrlDto, ListConversationsDto, ReplyDto } from "../dto/inbox.dto";

/**
 * Unified inbox conversations. `communications/conversations` is the channel-neutral
 * path used by the CRM; the original email-scoped path is kept as an alias so 15C
 * clients keep working. 15E will consolidate the naming.
 */
@Controller(["communications/conversations", "communications/email/conversations"])
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly dispatcher: EmailDispatcherService,
  ) {}

  /**
   * Send whatever was just queued, inside this request.
   *
   * The background dispatcher is a timer, and a timer only runs while the
   * process is alive. On a serverless host the instance is frozen as soon as the
   * request finishes, so a queued reply was being picked up and then abandoned
   * mid-flight — the provider call aborted and the message landed on "delivery
   * uncertain" instead of being sent.
   *
   * Draining here keeps the instance alive for the send. It stays best effort:
   * the row is already durably queued, so if this attempt fails the message is
   * retried later rather than lost.
   */
  private async flush(): Promise<void> {
    try {
      await this.dispatcher.runRepliesOnce();
    } catch {
      // Already queued and retryable — never fail the user's send over this.
    }
  }

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListConversationsDto) {
    return this.conversations.list(user, { view: query.view, channel: query.channel, contactId: query.contactId, search: query.search, page: query.page, pageSize: query.pageSize });
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
  async reply(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ReplyDto) {
    const result = await this.conversations.replyToConversation(user, id, dto.body, dto.attachments ?? [], dto.idempotencyKey);
    await this.flush();
    return result;
  }

  @Post(":id/messages/:messageId/retry")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  async retry(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Param("messageId", new ParseUUIDPipe()) messageId: string) {
    const result = await this.conversations.retryReply(user, id, messageId);
    await this.flush();
    return result;
  }

  @Get(":id/attachments/:attachmentId/download")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  download(@Param("id", new ParseUUIDPipe()) id: string, @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string) {
    return this.conversations.attachmentDownloadUrl(id, attachmentId);
  }
}
