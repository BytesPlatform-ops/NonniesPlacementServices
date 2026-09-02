import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsMimeType, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
import { CommunicationChannel, CommunicationInboundReviewStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { MAX_ATTACHMENTS } from "../email/attachment-policy";
import { MAX_REPLY_CHARS as REPLY_LIMIT } from "../email/reply-format";

const VIEWS = ["all", "unread", "needs_reply", "archived"] as const;

export class ListConversationsDto extends PaginationQueryDto {
  @IsOptional() @IsIn(VIEWS) view: (typeof VIEWS)[number] = "all";
  /** Unified inbox channel filter — omitted means every channel. */
  @IsOptional() @IsIn(Object.values(CommunicationChannel)) channel?: CommunicationChannel;
  /** Scope the list to a single contact (used by the contact detail history). */
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class ReplyAttachmentDto {
  @IsString() @MaxLength(300) path!: string;
  @IsString() @MaxLength(300) fileName!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
}

export class ReplyDto {
  @IsString() @MaxLength(REPLY_LIMIT) body!: string;
  /** Client-generated key making a repeated submit (double-click, retry) a no-op. */
  @IsOptional() @IsString() @MaxLength(64) idempotencyKey?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_ATTACHMENTS) @ValidateNested({ each: true }) @Type(() => ReplyAttachmentDto) attachments?: ReplyAttachmentDto[];
}

export class AttachmentUploadUrlDto {
  @IsString() @MaxLength(300) fileName!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
}

export class ListReviewDto extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(CommunicationInboundReviewStatus)) status?: CommunicationInboundReviewStatus;
  @IsOptional() @IsIn(Object.values(CommunicationChannel)) channel?: CommunicationChannel;
}

export class LinkReviewDto {
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() contactId?: string;
}
