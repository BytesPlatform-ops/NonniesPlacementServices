import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsMimeType, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
import { CommunicationInboundReviewStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { MAX_ATTACHMENTS } from "../email/attachment-policy";
import { MAX_REPLY_CHARS as REPLY_LIMIT } from "../email/reply-format";

const VIEWS = ["all", "unread", "needs_reply", "archived"] as const;

export class ListConversationsDto extends PaginationQueryDto {
  @IsOptional() @IsIn(VIEWS) view: (typeof VIEWS)[number] = "all";
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
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_ATTACHMENTS) @ValidateNested({ each: true }) @Type(() => ReplyAttachmentDto) attachments?: ReplyAttachmentDto[];
}

export class AttachmentUploadUrlDto {
  @IsString() @MaxLength(300) fileName!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
}

export class ListReviewDto extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(CommunicationInboundReviewStatus)) status?: CommunicationInboundReviewStatus;
}

export class LinkReviewDto {
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() contactId?: string;
}
