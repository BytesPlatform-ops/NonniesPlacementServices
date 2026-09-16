import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { UpdateMyCommunicationPreferencesDto } from "../dto/my-preferences.dto";
import { CONSENT_SOURCE_PREFERENCES, UserContactService } from "./user-contact.service";

/**
 * The signed-in person's OWN mobile number and SMS consent.
 *
 * Authenticated but intentionally not permission-gated, in the same way as
 * `GET /auth/me`: neither route takes an id, and both only ever read or write
 * the caller's own row, so there is no other person's data to authorize against.
 * Gating them on a permission would be worse, not better — it would mean some
 * signed-in people could not answer a consent question asked about themselves.
 *
 * Consent given here is what the existing campaign eligibility policy reads; it
 * is never inferred, and it is never granted on anyone else's behalf.
 */
@Controller("communications/me")
export class MyCommunicationPreferencesController {
  constructor(private readonly contact: UserContactService) {}

  @Get("communication-preferences")
  preferences(@CurrentUser() user: RequestUser) {
    return this.contact.preferences(user);
  }

  @Patch("communication-preferences")
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateMyCommunicationPreferencesDto) {
    return this.contact.savePreferences(user, { phone: dto.phone, smsConsent: dto.smsConsent, source: CONSENT_SOURCE_PREFERENCES });
  }
}
