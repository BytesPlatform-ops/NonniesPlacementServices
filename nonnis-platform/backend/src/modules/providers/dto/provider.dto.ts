import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ProviderStatus, CapacityStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateProviderDto {
  /** Link to an existing PROVIDER organization. Mutually exclusive with organizationName. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  /** Create a new PROVIDER organization with this name when organizationId is omitted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organizationName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  eligibilityNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseType?: string;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  eligibilityNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseType?: string;
}

export class ProviderStatusDto {
  @IsEnum(ProviderStatus)
  status!: ProviderStatus;
}

export class ListProvidersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;

  @IsOptional()
  @IsUUID()
  serviceCategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsUUID()
  languageId?: string;

  @IsOptional()
  @IsUUID()
  paymentTypeId?: string;

  @IsOptional()
  @IsEnum(CapacityStatus)
  availability?: CapacityStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value : "name"), { toClassOnly: true })
  @IsIn(["name", "updatedAt", "status"])
  sort?: "name" | "updatedAt" | "status";

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
