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
  /** Optional per-row consent columns (yes/no style values). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) emailConsent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) smsConsent?: number;
}

/**
 * The importer's statement that everyone in the file agreed to be contacted on
 * a channel. `source` says how that consent was collected and is required
 * whenever consent is recorded (validated in the service).
 */
export class ImportConsentDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsString() @MaxLength(200) source?: string;
}

export class ImportPreviewDto {
  @IsIn(["PASTE", "CSV", "TXT"]) sourceType!: "PASTE" | "CSV" | "TXT";

  /** Paste/TXT interpret each value as an email or a phone. */
  @IsOptional() @IsIn(["EMAIL", "PHONE"]) mode?: "EMAIL" | "PHONE";

  /** Raw text content (client reads the file; the file itself is never stored). */
  @IsString() @MaxLength(5_500_000) content!: string;

  @IsOptional() @IsString() @MaxLength(2) defaultCountry?: string;

  @IsOptional() @ValidateNested() @Type(() => CsvMappingDto) mapping?: CsvMappingDto;

  @IsOptional() @ValidateNested() @Type(() => ImportConsentDto) consent?: ImportConsentDto;

  @IsOptional() @IsBoolean() skipExisting?: boolean;
  @IsOptional() @IsBoolean() updateEmptyOnly?: boolean;
}

export class ImportCommitDto extends ImportPreviewDto {
  @IsOptional() @IsUUID() listId?: string;
  @IsOptional() @IsString() @MaxLength(160) newListName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tagNames?: string[];
  @IsOptional() @IsString() @MaxLength(260) originalFilename?: string;
  /** @deprecated Use `consent: { sms: true, source }`. Read as exactly that. */
  @IsOptional() @IsString() @MaxLength(200) smsConsentSource?: string;
}

export class CsvInspectDto {
  @IsString() @MaxLength(5_500_000) content!: string;
}
