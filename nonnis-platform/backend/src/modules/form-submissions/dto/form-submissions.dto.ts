import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from "class-validator";
import { FormSubmissionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

/**
 * One file arriving with a submission: the generated PDF record, or a document
 * the submitter uploaded. Bytes travel base64-encoded; the decoded size and the
 * MIME type are validated server-side before anything is stored.
 */
export class IngestSubmissionFileDto {
  @IsIn(["REPORT", "UPLOAD"])
  kind!: "REPORT" | "UPLOAD";

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  contentType!: string;

  @IsString()
  @IsNotEmpty()
  contentBase64!: string;
}

/** Payload the public website's server-side handler sends to the ingest endpoint. */
export class IngestFormSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  reference!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  formKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  formName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourcePage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  submitterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  submitterEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  submitterPhone?: string;

  /** Normalized submission payload (no secrets, no file bytes). */
  @IsObject()
  submittedData!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  emailStatus?: string;

  @IsOptional()
  @IsBoolean()
  reportGenerated?: boolean;

  @IsOptional()
  @IsBoolean()
  documentGenerated?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  attachmentsCount?: number;

  @IsOptional()
  @IsString()
  submittedAt?: string;

  /** Files to store privately alongside the record (PDF report and uploads). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => IngestSubmissionFileDto)
  files?: IngestSubmissionFileDto[];
}

export class ListFormSubmissionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  formKey?: string;

  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourcePage?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  reviewed?: boolean;

  /** Archived submissions are hidden by default; set this to include them. */
  @IsOptional()
  @toBool()
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  order?: "asc" | "desc";
}

export class UpdateFormSubmissionDto {
  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string;

  @IsOptional()
  @ValidateIf((o: UpdateFormSubmissionDto) => o.relatedCaseId !== null)
  @IsUUID()
  relatedCaseId?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateFormSubmissionDto) => o.relatedProviderId !== null)
  @IsUUID()
  relatedProviderId?: string | null;
}
