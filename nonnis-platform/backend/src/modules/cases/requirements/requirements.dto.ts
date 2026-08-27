import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { RequirementCategory, RequirementStatus } from "@prisma/client";

export class CreateRequirementDto {
  @IsEnum(RequirementCategory)
  category!: RequirementCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  serviceRequestId?: string;
}

export class UpdateRequirementDto {
  @IsOptional()
  @IsEnum(RequirementStatus)
  status?: RequirementStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
