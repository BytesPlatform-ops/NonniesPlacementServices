import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCaseDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** True when the family is being asked to supply this document. */
  @IsOptional()
  @IsBoolean()
  requestedFromSeeker?: boolean;

  @IsOptional()
  @IsIn(["CASE_TEAM", "CARE_SEEKER"])
  visibility?: "CASE_TEAM" | "CARE_SEEKER";

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

export class UploadCaseDocumentDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(200)
  contentType!: string;

  /** Base64 file bytes. Size and type are enforced server-side. */
  @IsString()
  contentBase64!: string;
}

export class ReviewCaseDocumentDto {
  @IsIn(["ACCEPTED", "NEEDS_UPDATE"])
  status!: "ACCEPTED" | "NEEDS_UPDATE";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}

export class SeekerScopedQueryDto {
  /** Optional when the family is linked to exactly one case. */
  @IsOptional()
  @IsString()
  @Type(() => String)
  caseId?: string;
}
