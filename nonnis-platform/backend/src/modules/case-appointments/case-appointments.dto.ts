import { IsIn, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

const APPOINTMENT_TYPES = ["TOUR", "ASSESSMENT", "MEETING", "MOVE_IN", "OTHER"] as const;
const STAFF_STATUSES = ["REQUESTED", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export class CreateCaseAppointmentDto {
  @IsOptional()
  @IsIn(APPOINTMENT_TYPES)
  type?: (typeof APPOINTMENT_TYPES)[number];

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  referralId?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}

export class UpdateCaseAppointmentDto extends CreateCaseAppointmentDto {
  @IsOptional()
  @IsIn(STAFF_STATUSES)
  status?: (typeof STAFF_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outcomeNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}

/** A family asking for a tour. No time: only staff can agree one. */
export class RequestAppointmentDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  referralId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  caseId?: string;
}

/** The three responses a family may give. Deliberately not a free status. */
export class RespondToAppointmentDto {
  @IsIn(["CONFIRM", "REQUEST_RESCHEDULE", "CANCEL"])
  action!: "CONFIRM" | "REQUEST_RESCHEDULE" | "CANCEL";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  caseId?: string;
}
