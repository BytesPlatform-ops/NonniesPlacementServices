import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

/** Parses a boolean-ish query string ("true"/"false") into a real boolean. */
const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

const CODE_PATTERN = /^[A-Z0-9_]+$/;

export class CreateServiceCategoryDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value), { toClassOnly: true })
  @Matches(CODE_PATTERN, { message: "code must contain only A-Z, 0-9 and underscores" })
  @MaxLength(60)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateServiceCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CatalogStatusDto {
  @IsBoolean()
  active!: boolean;
}

export class ListCatalogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateReferenceItemDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value), { toClassOnly: true })
  @Matches(CODE_PATTERN, { message: "code must contain only A-Z, 0-9 and underscores" })
  @MaxLength(60)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateReferenceItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
