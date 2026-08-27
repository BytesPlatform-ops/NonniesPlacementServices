import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { FacilityStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateFacilityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;

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
  @MaxLength(40)
  phone?: string;
}

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;

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
  @MaxLength(40)
  phone?: string;
}

export class FacilityStatusDto {
  @IsEnum(FacilityStatus)
  status!: FacilityStatus;
}

export class ListFacilitiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FacilityStatus)
  status?: FacilityStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
