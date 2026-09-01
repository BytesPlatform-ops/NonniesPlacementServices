import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CaseStatus,
  FormSubmissionStatus,
  ProviderStatus,
  ReferralStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), {
    toClassOnly: true,
  });

/** Core filters shared by every report (validated). */
export class BaseReportFilterDto {
  @IsOptional()
  @Matches(DATE_ONLY, { message: "dateFrom must be YYYY-MM-DD" })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: "dateTo must be YYYY-MM-DD" })
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

/** Base + pagination + search + sort for the list-style reports. */
export class BaseReportListDto extends BaseReportFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}

export class CasesReportDto extends BaseReportListDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsIn(["READY", "NEEDS_ATTENTION", "BLOCKED"])
  readinessLevel?: "READY" | "NEEDS_ATTENTION" | "BLOCKED";

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "expectedDischargeDate", "caseNumber", "status"])
  sort?: string;
}

export class ReferralsReportDto extends BaseReportListDto {
  @IsOptional()
  @IsEnum(ReferralStatus)
  referralStatus?: ReferralStatus;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  serviceCategoryId?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  includeDrafts?: boolean;

  @IsOptional()
  @IsIn(["sentAt", "createdAt", "responseDueAt", "status"])
  sort?: string;
}

export class ProvidersReportDto extends BaseReportListDto {
  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;

  @IsOptional()
  @IsUUID()
  serviceCategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsIn(["AVAILABLE", "LIMITED", "UNAVAILABLE", "UNKNOWN"])
  capacityStatus?: "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "UNKNOWN";

  @IsOptional()
  @IsUUID()
  languageId?: string;

  @IsOptional()
  @IsUUID()
  paymentTypeId?: string;

  @IsOptional()
  @IsIn(["displayName", "status", "state", "city", "updatedAt"])
  sort?: string;
}

export class ReadinessReportDto extends BaseReportListDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsIn(["READY", "NEEDS_ATTENTION", "BLOCKED"])
  readinessLevel?: "READY" | "NEEDS_ATTENTION" | "BLOCKED";

  @IsOptional()
  @Matches(DATE_ONLY, { message: "expectedFrom must be YYYY-MM-DD" })
  expectedFrom?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: "expectedTo must be YYYY-MM-DD" })
  expectedTo?: string;

  @IsOptional()
  @IsIn([
    "CRITICAL_BLOCKER",
    "PLACEMENT_MISSING",
    "SERVICE_UNSCHEDULED",
    "DISCHARGED_NOT_STARTED",
    "NEAR_TERM_NOT_READY",
  ])
  blockerType?:
    | "CRITICAL_BLOCKER"
    | "PLACEMENT_MISSING"
    | "SERVICE_UNSCHEDULED"
    | "DISCHARGED_NOT_STARTED"
    | "NEAR_TERM_NOT_READY";

  @IsOptional()
  @IsIn(["expectedDischargeDate", "createdAt", "caseNumber", "status"])
  sort?: string;
}

export class TasksReportDto extends BaseReportListDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsIn(["createdAt", "dueAt", "priority", "status", "completedAt"])
  sort?: string;
}

export class FormSubmissionsReportDto extends BaseReportListDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  formKey?: string;

  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @IsOptional()
  @toBool()
  @IsBoolean()
  reviewed?: boolean;

  @IsOptional()
  @IsIn(["submittedAt", "status", "formKey"])
  sort?: string;
}

/** Overview accepts the core filters only (no pagination). */
export class OverviewReportDto extends BaseReportFilterDto {}
