import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { InboundReviewService } from "./inbound-review.service";
import { LinkReviewDto, ListReviewDto } from "../dto/inbox.dto";

@Controller("communications/email/inbound-review")
export class InboundReviewController {
  constructor(private readonly review: InboundReviewService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListReviewDto) {
    return this.review.list(query.status, query.page, query.pageSize);
  }

  @Get("count")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  count() {
    return this.review.pendingCount().then((count) => ({ count }));
  }

  @Post(":id/link")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  link(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: LinkReviewDto) {
    return this.review.link(user, id, { conversationId: dto.conversationId, contactId: dto.contactId });
  }

  @Post(":id/dismiss")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  dismiss(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.review.dismiss(user, id);
  }
}
