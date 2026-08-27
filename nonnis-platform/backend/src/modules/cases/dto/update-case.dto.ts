import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CareSetting } from "@prisma/client";

/** Editable case fields. Patient identity is managed separately. */
export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalCaseId?: string;

  @IsOptional()
  @IsDateString()
  expectedDischargeDate?: string;

  @IsOptional()
  @IsDateString()
  actualDischargeDate?: string;

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
  @IsString()
  @MaxLength(40)
  patientContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeRelationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  representativeContact?: string;

  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  blockReason?: string;
}
