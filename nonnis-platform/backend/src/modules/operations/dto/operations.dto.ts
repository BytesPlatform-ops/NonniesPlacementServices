import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CaseStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

export class ListOperationsCasesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  expectedFrom?: string;

  @IsOptional()
  @IsString()
  expectedTo?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  attentionOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  blockedOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  incompleteOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  unassignedOnly?: boolean;

  // Readiness filters (server-side; approximate deterministic signals).
  @IsOptional()
  @toBool()
  @IsBoolean()
  readyOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  notReadyOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  criticalBlockerOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  placementMissingOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  serviceUnscheduledOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  postDischargeNotStartedOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  nearTermNotReadyOnly?: boolean;

  @IsOptional()
  @IsIn(["expectedDischargeDate", "updatedAt", "createdAt", "status", "caseNumber"])
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
