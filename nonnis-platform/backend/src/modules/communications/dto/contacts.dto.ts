import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { CommunicationChannel, CommunicationConsentStatus, CommunicationContactStatus } from "@prisma/client";

const toBool = () =>
  Transform(({ value }) => (typeof value === "string" ? value === "true" : Boolean(value)), { toClassOnly: true });

export class CreateContactDto {
  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @IsString() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) organizationName?: string;
  /** Default country for phone normalization (ISO-2, e.g. "US"). */
  @IsOptional() @IsString() @MaxLength(2) defaultCountry?: string;
}

export class UpdateContactDto extends CreateContactDto {}

export class SetConsentDto {
  @IsEnum(CommunicationChannel) channel!: CommunicationChannel;
  @IsEnum(CommunicationConsentStatus) consentStatus!: CommunicationConsentStatus;
  @IsOptional() @IsString() @MaxLength(200) consentSource?: string;
}

/**
 * The contact filters, shared by the list view and by bulk actions so a bulk
 * change applies to exactly the contacts the person is looking at.
 */
export class ContactFilterDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationContactStatus) status?: CommunicationContactStatus;
  @IsOptional() @toBool() @IsBoolean() hasEmail?: boolean;
  @IsOptional() @toBool() @IsBoolean() hasPhone?: boolean;
  @IsOptional() @IsEnum(CommunicationConsentStatus) emailConsent?: CommunicationConsentStatus;
  @IsOptional() @IsEnum(CommunicationConsentStatus) smsConsent?: CommunicationConsentStatus;
  @IsOptional() @IsUUID() listId?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsIn(["EMAIL", "SMS"]) suppressed?: "EMAIL" | "SMS";
}

export class ListContactsDto extends ContactFilterDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20;
  @IsOptional() @IsIn(["updatedAt", "createdAt", "organizationName"]) sort?: string;
  @IsOptional() @IsIn(["asc", "desc"]) order?: "asc" | "desc";
}

/** Record consent on every contact matching the filters (see ContactsService.bulkSetConsent). */
export class BulkConsentDto extends ContactFilterDto {
  @IsEnum(CommunicationChannel) channel!: CommunicationChannel;
  @IsIn(["OPTED_IN", "OPTED_OUT"]) consentStatus!: "OPTED_IN" | "OPTED_OUT";
  @IsOptional() @IsString() @MaxLength(200) consentSource?: string;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
