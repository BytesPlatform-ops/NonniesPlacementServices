import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import type { MediaKind } from "../media.service";

export class CreateUploadUrlDto {
  @IsIn(["blog-featured", "video", "poster", "email-image"])
  kind!: MediaKind;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  /** Original filename — for diagnostics only; never used as the storage path. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  filename?: string;
}

export class DeleteMediaDto {
  @IsString()
  @MaxLength(400)
  storagePath!: string;
}
