import type { CommunicationConsentStatus } from "@prisma/client";

/**
 * Consent values a person can put in an import file, read as the platform's
 * consent states. Anything else (blank, "maybe", a date) is no statement at
 * all and leaves consent UNKNOWN — a cell is never guessed into OPTED_IN.
 */
const OPT_IN_VALUES = new Set(["yes", "y", "true", "1", "opted in", "opted-in", "opt in", "opt-in", "optin", "subscribed", "consented", "consent", "start"]);
const OPT_OUT_VALUES = new Set(["no", "n", "false", "0", "opted out", "opted-out", "opt out", "opt-out", "optout", "unsubscribed", "stop", "declined"]);

export type ExplicitConsent = Extract<CommunicationConsentStatus, "OPTED_IN" | "OPTED_OUT">;

export function parseConsentCell(value: string | undefined | null): ExplicitConsent | null {
  if (value === undefined || value === null) return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return null;
  if (OPT_OUT_VALUES.has(v)) return "OPTED_OUT";
  if (OPT_IN_VALUES.has(v)) return "OPTED_IN";
  return null;
}

/**
 * Combines what one row says with what the importer attested for the whole
 * file. An opt-out always wins: a "no" in the file is never overridden by a
 * blanket attestation.
 */
export function resolveImportConsent(cell: ExplicitConsent | null, attestedForFile: boolean): ExplicitConsent | null {
  if (cell === "OPTED_OUT") return "OPTED_OUT";
  if (cell === "OPTED_IN" || attestedForFile) return "OPTED_IN";
  return null;
}

/**
 * Whether a recorded consent may be replaced by `next` without a person
 * looking at that one contact. Opting in only fills UNKNOWN — it never revives
 * an opt-out (a STOP reply, an unsubscribe). Opting out may always be recorded.
 */
export function mayApplyConsent(current: CommunicationConsentStatus | null | undefined, next: ExplicitConsent): boolean {
  const now = current ?? "UNKNOWN";
  if (now === next) return false;
  if (next === "OPTED_OUT") return true;
  return now === "UNKNOWN";
}

/** Fields written to a ContactChannelPreference for an explicit consent. */
export function consentFields(status: ExplicitConsent, source: string, at: Date) {
  return {
    consentStatus: status,
    consentSource: source,
    consentAt: status === "OPTED_IN" ? at : null,
    optOutAt: status === "OPTED_OUT" ? at : null,
  };
}
