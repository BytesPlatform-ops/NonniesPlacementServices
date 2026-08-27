import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  CareSetting,
  CaseStatus,
  LevelOfCare,
  RequirementCategory,
  ServiceCategory,
} from "@prisma/client";

/** New patient details, when the case is not associated to an existing patient. */
export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;
}

/** A requested post-discharge service supplied at case-creation time. */
export class CreateServiceRequestDto {
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

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
  @MaxLength(2000)
  notes?: string;
}

/** A discrete requirement / constraint supplied at case-creation time. */
export class CreateCaseRequirementDto {
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
}

/** Create a discharge case. */
export class CreateCaseDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  originatingFacilityId!: string;

  /** Associate an existing patient. Provide this OR `patient`, not both. */
  @IsOptional()
  @IsUUID()
  patientId?: string;

  /** Create a new patient. Provide this OR `patientId`, not both. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient?: CreatePatientDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalCaseId?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dischargeProfessionalRef?: string;

  @IsOptional()
  @IsDateString()
  expectedDischargeDate?: string;

  @IsOptional()
  @IsEnum(CareSetting)
  currentCareSetting?: CareSetting;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferredServiceLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  primaryLanguage?: string;

  @IsOptional()
  @IsBoolean()
  interpreterRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  communicationPreference?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  accessibilityNeeds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceRequestDto)
  serviceRequests?: CreateServiceRequestDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCaseRequirementDto)
  requirements?: CreateCaseRequirementDto[];
}
