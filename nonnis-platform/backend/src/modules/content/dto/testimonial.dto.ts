import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

export class CreateTestimonialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  quote!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  quote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ListTestimonialsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  activeOnly?: boolean;
}
