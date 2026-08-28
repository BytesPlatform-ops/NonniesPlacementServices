import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { LevelOfCare, ServiceCategoryCode } from "@prisma/client";

class ServiceRequestFields {
  @IsOptional()
  @IsEnum(LevelOfCare)
  levelOfCare?: LevelOfCare;

  @IsOptional()
  @IsDateString()
  requestedStartDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  durationText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  servicePostalCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceRadiusMiles?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fundingSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  insurancePlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  requiredQualifications?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mandatoryLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  equipmentNeeds?: string;

  @IsOptional()
  @IsBoolean()
  transportationRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateServiceRequestDto extends ServiceRequestFields {
  @IsEnum(ServiceCategoryCode)
  category!: ServiceCategoryCode;
}

export class UpdateServiceRequestDto extends ServiceRequestFields {
  @IsOptional()
  @IsEnum(ServiceCategoryCode)
  category?: ServiceCategoryCode;
}
