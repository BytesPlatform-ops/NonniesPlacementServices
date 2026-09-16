import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ListMessagesDto } from "../messages/dto/messages.dto";

export class GrantCareSeekerAccessDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  /** e.g. "Daughter". Display only — it never affects what they can see. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;
}

export class UpdateCareSeekerAccessDto {
  @IsString()
  status!: "ACTIVE" | "REVOKED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Optional case selector, for a relative authorized on more than one case. */
export class SeekerCaseQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  caseId?: string;
}

/**
 * Paged message list for one case.
 *
 * A class rather than `ListMessagesDto & SeekerCaseQueryDto`: TypeScript emits
 * `Object` as the design type of an intersection, and Nest's ValidationPipe skips
 * anything typed `Object`. That silently disabled both validation AND transform
 * on this route, so `page` never received its default and `pageSize` stayed a
 * string — which Prisma rejected as an invalid query.
 */
export class ListSeekerMessagesDto extends ListMessagesDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  caseId?: string;
}

export class SendSeekerMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  caseId?: string;
}

export class UploadSeekerDocumentDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(200)
  contentType!: string;

  @IsString()
  contentBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  caseId?: string;
}

/** Self-service profile fields. Role, case links and email are not editable. */
export class UpdateSeekerAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}
