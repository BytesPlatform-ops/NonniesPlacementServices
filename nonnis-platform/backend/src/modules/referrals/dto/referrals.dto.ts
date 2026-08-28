import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { ReferralDeclineReason, ReferralStatus, ServiceStartFailureReason } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

export class CreateReferralDto {
  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsDateString()
  responseDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coordinationNote?: string;

  /** When true, create and immediately send in one action. */
  @IsOptional()
  @IsBoolean()
  sendNow?: boolean;
}

export class SendReferralDto {
  @IsOptional()
  @IsDateString()
  responseDueAt?: string;
}

export class WithdrawReferralDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ProvideInformationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}

export class AssignReferralDto {
  @IsOptional()
  @ValidateIf((o: AssignReferralDto) => o.assignedUserId !== null)
  @IsUUID()
  assignedUserId?: string | null;
}

export class SchedulePlacementDto {
  @IsDateString()
  scheduledStartAt!: string;
}

export class ConfirmStartDto {
  @IsOptional()
  @IsDateString()
  actualStartAt?: string;
}

export class ReportUnsuccessfulStartDto {
  @IsEnum(ServiceStartFailureReason)
  reason!: ServiceStartFailureReason;

  @ValidateIf((o: ReportUnsuccessfulStartDto) => o.reason === "OTHER")
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note?: string;
}

export type ReferralResponseAction = "ACCEPT" | "CONDITIONALLY_ACCEPT" | "REQUEST_INFORMATION" | "DECLINE";

export class RespondReferralDto {
  @IsIn(["ACCEPT", "CONDITIONALLY_ACCEPT", "REQUEST_INFORMATION", "DECLINE"])
  action!: ReferralResponseAction;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  // REQUEST_INFORMATION requires a question.
  @ValidateIf((o: RespondReferralDto) => o.action === "REQUEST_INFORMATION")
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  question?: string;

  // CONDITIONALLY_ACCEPT requires a condition.
  @ValidateIf((o: RespondReferralDto) => o.action === "CONDITIONALLY_ACCEPT")
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  conditions?: string;

  @IsOptional()
  @IsDateString()
  proposedStartDate?: string;

  @IsOptional()
  @IsBoolean()
  fundingConfirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  capacityConfirmed?: boolean;

  // DECLINE requires a structured reason (+ note when OTHER).
  @ValidateIf((o: RespondReferralDto) => o.action === "DECLINE")
  @IsEnum(ReferralDeclineReason)
  declineReason?: ReferralDeclineReason;

  @ValidateIf((o: RespondReferralDto) => o.action === "DECLINE" && o.declineReason === "OTHER")
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  declineNote?: string;
}

export class ListReferralsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @toBool()
  @IsBoolean()
  overdueOnly?: boolean;

  @IsOptional()
  @toBool()
  @IsBoolean()
  actionRequired?: boolean;

  // Operations-only extra filters (ignored for provider inbox).
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsIn(["createdAt", "sentAt", "responseDueAt", "updatedAt"])
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
