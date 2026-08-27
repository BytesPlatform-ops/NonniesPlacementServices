import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CaseStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () => Transform(({ value }) => value === true || value === "true" || value === "1");

/** Validated, whitelisted query parameters for the case list. */
export class ListCasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsDateString()
  expectedFrom?: string;

  @IsOptional()
  @IsDateString()
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
  incompleteOnly?: boolean;

  @IsOptional()
  @IsIn(["expectedDischargeDate", "updatedAt", "createdAt", "status", "caseNumber"])
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: string;
}
