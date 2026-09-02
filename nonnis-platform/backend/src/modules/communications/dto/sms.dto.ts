import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { CommunicationSmsCampaignStatus, CommunicationSmsRecipientStatus, CommunicationSmsTemplateStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { AudienceDto } from "./email-campaign.dto";
import { MAX_SMS_BODY_CHARS } from "../sms/sms-segments";

// ---- Templates ----
export class CreateSmsTemplateDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body!: string;
}

export class UpdateSmsTemplateDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body?: string;
  @IsOptional() @IsEnum(CommunicationSmsTemplateStatus) status?: CommunicationSmsTemplateStatus;
}

export class ListSmsTemplatesDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationSmsTemplateStatus) status?: CommunicationSmsTemplateStatus;
}

/** Preview an arbitrary body (unsaved editor content) with sample merge values. */
export class PreviewSmsDto {
  @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body!: string;
}

export class TestSmsDto {
  @IsString() @MaxLength(40) phone!: string;
  /** Optional override body; defaults to the stored template body. */
  @IsOptional() @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body?: string;
}

// ---- Campaigns ----
export class CreateSmsCampaignDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body?: string;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
}

export class UpdateSmsCampaignDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body?: string;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
}

/** Audience + rendered-body preview before a campaign exists. */
export class SmsAudiencePreviewDto {
  @ValidateNested() @Type(() => AudienceDto) audience!: AudienceDto;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body?: string;
}

export class ListSmsCampaignsDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationSmsCampaignStatus) status?: CommunicationSmsCampaignStatus;
}

export class ListSmsRecipientsDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(CommunicationSmsRecipientStatus) status?: CommunicationSmsRecipientStatus;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

// ---- Conversation reply ----
export class SmsReplyDto {
  @IsString() @MaxLength(MAX_SMS_BODY_CHARS) body!: string;
}
