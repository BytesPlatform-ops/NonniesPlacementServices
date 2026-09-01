import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CommunicationChannel, CommunicationConsentStatus, CommunicationContactStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

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

export class ListContactsDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(CommunicationContactStatus) status?: CommunicationContactStatus;
  @IsOptional() @toBool() @IsBoolean() hasEmail?: boolean;
  @IsOptional() @toBool() @IsBoolean() hasPhone?: boolean;
  @IsOptional() @IsEnum(CommunicationConsentStatus) emailConsent?: CommunicationConsentStatus;
  @IsOptional() @IsEnum(CommunicationConsentStatus) smsConsent?: CommunicationConsentStatus;
  @IsOptional() @IsUUID() listId?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsIn(["EMAIL", "SMS"]) suppressed?: "EMAIL" | "SMS";
  @IsOptional() @IsIn(["updatedAt", "createdAt", "organizationName"]) sort?: string;
  @IsOptional() @IsIn(["asc", "desc"]) order?: "asc" | "desc";
}
