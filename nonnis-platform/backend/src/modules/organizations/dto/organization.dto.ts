import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { OrganizationStatus, OrganizationType } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateOrganizationDto {
  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}

export class OrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;
}

export class ListOrganizationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
