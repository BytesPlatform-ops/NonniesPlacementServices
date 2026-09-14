import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CapacityStatus, CoverageType, DayOfWeek, LevelOfCare } from "@prisma/client";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- Provider services ----

export class CreateProviderServiceDto {
  @IsUUID()
  serviceCategoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(LevelOfCare)
  levelOfCare?: LevelOfCare;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProviderServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(LevelOfCare)
  levelOfCare?: LevelOfCare;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ---- Coverage ----

export class CreateCoverageAreaDto {
  @IsOptional()
  @IsEnum(CoverageType)
  coverageType?: CoverageType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  county?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  /** Every postal code this area covers. Authoritative over `postalCode`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  postalCodes?: string[];

  /** ISO-3166-1 alpha-2. Defaults to US when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine?: string;

  /** Only set when a real coordinate is known; never derived from a name. */
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  radiusMiles?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCoverageAreaDto extends CreateCoverageAreaDto {}

// ---- Payment types ----

export class CreateProviderPaymentTypeDto {
  @IsUUID()
  paymentTypeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProviderPaymentTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ---- Languages ----

export class CreateProviderLanguageDto {
  @IsUUID()
  languageId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProviderLanguageDto {
  @IsBoolean()
  active!: boolean;
}

// ---- Hours ----

export class HoursEntryDto {
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @IsOptional()
  @IsBoolean()
  closed?: boolean;

  @IsOptional()
  @IsBoolean()
  open24?: boolean;

  @ValidateIf((o: HoursEntryDto) => !o.closed && !o.open24)
  @Matches(TIME_PATTERN, { message: "opensAt must be HH:MM (24-hour)" })
  opensAt?: string;

  @ValidateIf((o: HoursEntryDto) => !o.closed && !o.open24)
  @Matches(TIME_PATTERN, { message: "closesAt must be HH:MM (24-hour)" })
  closesAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class SetHoursDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => HoursEntryDto)
  hours!: HoursEntryDto[];
}

// ---- Capacity ----

export class SetCapacityDto {
  @IsOptional()
  @ValidateIf((o: SetCapacityDto) => o.serviceCategoryId !== null)
  @IsUUID()
  serviceCategoryId?: string | null;

  @IsEnum(CapacityStatus)
  status!: CapacityStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  availableCount?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "effectiveDate must be YYYY-MM-DD" })
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
