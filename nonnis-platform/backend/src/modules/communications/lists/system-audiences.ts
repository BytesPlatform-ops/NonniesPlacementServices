import type { Prisma } from "@prisma/client";

/**
 * Derived audiences: lists whose membership is a question, not a table.
 *
 * A curated list answers "who did someone put in here?". A derived audience
 * answers "who qualifies right now?" — and for consent that is the only honest
 * answer. Materializing membership on opt-in would create a second record of the
 * same fact, and two records of one fact eventually disagree: a failed write, a
 * consent change made directly in the CRM, or a STOP handled by the webhook and
 * the audience is quietly wrong about who agreed to be texted.
 *
 * So nothing is written when somebody opts in. The audience is resolved from the
 * consent rows themselves, at preview and again at queue time. Opting out
 * removes a person from every future send the instant it is recorded, and no
 * reconciliation job has to exist.
 *
 * Historical campaigns are unaffected: they hold their own recipient snapshots,
 * taken at queue time and never revisited.
 */
export const SYSTEM_AUDIENCE_KEYS = {
  /** Everyone who has explicitly agreed to SMS. */
  SMS_OPTED_IN: "SMS_OPTED_IN",
} as const;

export type SystemAudienceKey = (typeof SYSTEM_AUDIENCE_KEYS)[keyof typeof SYSTEM_AUDIENCE_KEYS];

export interface SystemAudienceDefinition {
  key: SystemAudienceKey;
  name: string;
  description: string;
  /**
   * Membership predicate against CommunicationContact.
   *
   * It selects who BELONGS to the audience. It deliberately does NOT apply the
   * full send-eligibility policy — no suppression, phone-format or archive
   * checks here. Those stay in `evaluateChannelEligibility`, the one place that
   * decides deliverability, so the Review screen can still show "audience
   * members" against "eligible" and name what was excluded and why.
   */
  where: Prisma.CommunicationContactWhereInput;
}

export const SYSTEM_AUDIENCES: Record<SystemAudienceKey, SystemAudienceDefinition> = {
  [SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN]: {
    key: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN,
    name: "SMS subscribers",
    description: "Everyone who has explicitly opted in to SMS. Membership follows consent automatically — nobody is added or removed by hand.",
    where: {
      preferences: { some: { channel: "SMS", consentStatus: "OPTED_IN" } },
    },
  },
};

export function isSystemAudienceKey(key: string | null | undefined): key is SystemAudienceKey {
  return !!key && key in SYSTEM_AUDIENCES;
}

export function systemAudience(key: string | null | undefined): SystemAudienceDefinition | null {
  return isSystemAudienceKey(key) ? SYSTEM_AUDIENCES[key] : null;
}
