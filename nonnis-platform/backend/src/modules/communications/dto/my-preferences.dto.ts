import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * The caller's own contact details. `smsConsent` is deliberately optional and
 * deliberately a boolean: absent means "not answered", which is never consent.
 */
export class UpdateMyCommunicationPreferencesDto {
  @IsString() @MaxLength(32) phone!: string;
  @IsOptional() @IsBoolean() smsConsent?: boolean;
}
