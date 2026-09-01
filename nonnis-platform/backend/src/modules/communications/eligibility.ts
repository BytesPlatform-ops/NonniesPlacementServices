import type { CommunicationChannel, CommunicationConsentStatus } from "@prisma/client";

/**
 * Deterministic, reusable channel-eligibility policy. It NEVER sends anything —
 * it is the single source of truth that campaign building (15B/15D) will reuse to
 * decide whether a contact may be contacted on a channel. Marketing eligibility
 * requires explicit OPTED_IN consent; UNKNOWN is never treated as opted-in.
 */

export type EmailEligibilityReason = "NO_EMAIL" | "INVALID_EMAIL" | "CONSENT_UNKNOWN" | "OPTED_OUT" | "SUPPRESSED" | "CONTACT_ARCHIVED";
export type SmsEligibilityReason = "NO_PHONE" | "INVALID_PHONE" | "CONSENT_UNKNOWN" | "OPTED_OUT" | "SUPPRESSED" | "CONTACT_ARCHIVED";
export type EligibilityReason = EmailEligibilityReason | SmsEligibilityReason;

export interface ChannelEligibilityInput {
  channel: CommunicationChannel;
  archived: boolean;
  /** Normalized address present (normalizedEmail / normalizedPhoneE164). */
  hasAddress: boolean;
  /** Address passed format/E.164 validation. */
  addressValid: boolean;
  consentStatus: CommunicationConsentStatus;
  suppressed: boolean;
}

export interface ChannelEligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

export function evaluateChannelEligibility(input: ChannelEligibilityInput): ChannelEligibilityResult {
  const reasons: EligibilityReason[] = [];
  const email = input.channel === "EMAIL";

  if (input.archived) reasons.push("CONTACT_ARCHIVED");
  if (!input.hasAddress) reasons.push(email ? "NO_EMAIL" : "NO_PHONE");
  else if (!input.addressValid) reasons.push(email ? "INVALID_EMAIL" : "INVALID_PHONE");

  if (input.consentStatus === "OPTED_OUT") reasons.push("OPTED_OUT");
  else if (input.consentStatus === "UNKNOWN") reasons.push("CONSENT_UNKNOWN");

  if (input.suppressed) reasons.push("SUPPRESSED");

  return { eligible: reasons.length === 0, reasons };
}
