import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class MarkDischargedDto {
  /** Actual discharge date/time. Required — discharge is never inferred. */
  @IsDateString()
  actualDischargeDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MarkReadyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MarkServiceStartedDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MarkCompletedDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
