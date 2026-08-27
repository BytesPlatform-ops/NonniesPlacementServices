import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CaseStatus } from "@prisma/client";

export class TransitionCaseDto {
  @IsEnum(CaseStatus)
  toStatus!: CaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
