import { IsEmail, IsEnum, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CommunicationEmailTemplateStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateEmailTemplateDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(300) subjectDefault?: string;
  @IsOptional() @IsString() @MaxLength(300) preheaderDefault?: string;
  /** Block design JSON — deeply validated + compiled server-side. */
  @IsObject() designJson!: Record<string, unknown>;
}

export class UpdateEmailTemplateDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(300) subjectDefault?: string;
  @IsOptional() @IsString() @MaxLength(300) preheaderDefault?: string;
  @IsOptional() @IsObject() designJson?: Record<string, unknown>;
  @IsOptional() @IsEnum(CommunicationEmailTemplateStatus) status?: CommunicationEmailTemplateStatus;
}

export class PreviewDesignDto {
  @IsObject() designJson!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(300) preheader?: string;
  @IsOptional() @ValidateNested() @Type(() => SampleValues) sampleValues?: SampleValues;
}

export class SampleValues {
  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @IsString() @MaxLength(200) organizationName?: string;
}

export class TestSendDto {
  @IsEmail() @MaxLength(320) toEmail!: string;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @ValidateNested() @Type(() => SampleValues) sampleValues?: SampleValues;
}

export class ListEmailTemplatesDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationEmailTemplateStatus) status?: CommunicationEmailTemplateStatus;
}
