import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Column index mapping for CSV imports (field -> zero-based column index). */
export class CsvMappingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) firstName?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lastName?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) email?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) phone?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) organization?: number;
}

export class ImportPreviewDto {
  @IsIn(["PASTE", "CSV", "TXT"]) sourceType!: "PASTE" | "CSV" | "TXT";

  /** Paste/TXT interpret each value as an email or a phone. */
  @IsOptional() @IsIn(["EMAIL", "PHONE"]) mode?: "EMAIL" | "PHONE";

  /** Raw text content (client reads the file; the file itself is never stored). */
  @IsString() @MaxLength(5_500_000) content!: string;

  @IsOptional() @IsString() @MaxLength(2) defaultCountry?: string;

  @IsOptional() @ValidateNested() @Type(() => CsvMappingDto) mapping?: CsvMappingDto;

  @IsOptional() @IsBoolean() skipExisting?: boolean;
  @IsOptional() @IsBoolean() updateEmptyOnly?: boolean;
}

export class ImportCommitDto extends ImportPreviewDto {
  @IsOptional() @IsUUID() listId?: string;
  @IsOptional() @IsString() @MaxLength(160) newListName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tagNames?: string[];
  @IsOptional() @IsString() @MaxLength(260) originalFilename?: string;
  /**
   * Set only when the importer confirms every NEW contact with a phone agreed
   * to receive texts; records SMS consent OPTED_IN with this as the source.
   * Never applied to existing (duplicate) contacts.
   */
  @IsOptional() @IsString() @MaxLength(200) smsConsentSource?: string;
}

export class CsvInspectDto {
  @IsString() @MaxLength(5_500_000) content!: string;
}
