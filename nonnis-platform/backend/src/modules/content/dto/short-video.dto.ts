import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsNotEmpty, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { URL_OR_PATH } from "./blog.dto";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

export class CreateShortVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  caption?: string;

  @IsString()
  @Matches(URL_OR_PATH, { message: "videoUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  videoUrl!: string;

  @IsOptional()
  @IsString()
  @Matches(URL_OR_PATH, { message: "posterImageUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  posterImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sourceLabel?: string;

  @IsOptional()
  @IsUUID()
  blogPostId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateShortVideoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  caption?: string;

  @IsOptional()
  @IsString()
  @Matches(URL_OR_PATH, { message: "videoUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(URL_OR_PATH, { message: "posterImageUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  posterImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sourceLabel?: string;

  @IsOptional()
  @IsUUID()
  blogPostId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ListShortVideosDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  activeOnly?: boolean;
}
