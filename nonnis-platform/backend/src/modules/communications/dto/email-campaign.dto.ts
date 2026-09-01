import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { CommunicationEmailCampaignStatus, CommunicationEmailRecipientStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class AudienceDto {
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID("4", { each: true }) listIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsUUID("4", { each: true }) contactIds?: string[];
}

export class CreateCampaignDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @IsString() @MaxLength(300) preheader?: string;
  @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @IsString() @MaxLength(300) preheader?: string;
  @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
}

export class AudiencePreviewDto {
  @ValidateNested() @Type(() => AudienceDto) audience!: AudienceDto;
}

export class ListCampaignsDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationEmailCampaignStatus) status?: CommunicationEmailCampaignStatus;
}

export class ListRecipientsDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(CommunicationEmailRecipientStatus) status?: CommunicationEmailRecipientStatus;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
