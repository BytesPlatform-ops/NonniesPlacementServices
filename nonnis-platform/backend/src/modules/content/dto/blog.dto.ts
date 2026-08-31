import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { ContentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "../content-slug";

/** Absolute http(s) URL or a root-relative site path (e.g. /assets/x.jpg). Blocks javascript:/data: schemes. */
export const URL_OR_PATH = /^(https?:\/\/[^\s]+|\/[^\s]*)$/;
const trim = () => Transform(({ value }) => (typeof value === "string" ? value.trim() : value), { toClassOnly: true });

export class CreateBlogPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @trim()
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: "slug must be lowercase words separated by single hyphens" })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  body!: string;

  @IsOptional()
  @IsString()
  @Matches(URL_OR_PATH, { message: "featuredImageUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  featuredImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  featuredImageStoragePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayAuthor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

/** All fields optional for a partial update. */
export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @trim()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: "slug must be lowercase words separated by single hyphens" })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  body?: string;

  @IsOptional()
  @IsString()
  @Matches(URL_OR_PATH, { message: "featuredImageUrl must be an http(s) URL or a site path" })
  @MaxLength(1000)
  featuredImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  featuredImageStoragePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayAuthor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;
}

export class ListBlogPostsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsIn(["updatedAt", "createdAt", "publishedAt", "title"])
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}

/** Public blog list query (no auth) — category filter + pagination only. */
export class PublicBlogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
