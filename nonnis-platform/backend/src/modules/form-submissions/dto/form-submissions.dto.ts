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
import { FormSubmissionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

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
