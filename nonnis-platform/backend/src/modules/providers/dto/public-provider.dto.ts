import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

/** Public directory list query — only family-useful, structured filters. */
export class PublicProviderListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit: number = 12;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsUUID()
  serviceCategory?: string;

  @IsOptional()
  @IsUUID()
  language?: string;

  @IsOptional()
  @IsUUID()
  paymentType?: string;

  @IsOptional()
  @IsIn(["name", "recent"])
  sort?: "name" | "recent";
}
