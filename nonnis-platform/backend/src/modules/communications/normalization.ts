import { isEmail } from "class-validator";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Pure normalization + format-validation for contact channels. Email checks are
 * FORMAT validation only (they never prove a mailbox exists). Phone parsing uses
 * libphonenumber-js — never fragile regex.
 */

export interface EmailValue {
  display: string;
  normalized: string;
}

/** Trim an email; returns null when empty. Does not validate format. */
export function cleanEmail(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : null;
}

/** FORMAT validation only — not mailbox verification. */
export function isValidEmailFormat(email: string): boolean {
  return isEmail(email);
}

/** Lowercased, trimmed form used for comparison, dedup and search. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Build a validated email value, or null if empty/invalid. */
export function toEmailValue(raw: string | null | undefined): EmailValue | null {
  const cleaned = cleanEmail(raw);
  if (!cleaned || !isValidEmailFormat(cleaned)) return null;
  return { display: cleaned, normalized: normalizeEmail(cleaned) };
}

export interface PhoneValue {
  display: string;
  e164: string;
}

/** Trim a phone; returns null when empty. */
export function cleanPhone(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Parse a phone into E.164 using the given default country for numbers without
 * an international prefix. Returns null when the number is invalid.
 */
export function normalizePhoneE164(raw: string | null | undefined, defaultCountry: CountryCode = "US"): string | null {
  const cleaned = cleanPhone(raw);
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164, e.g. +15551234567
}

/** Build a validated phone value, or null if empty/invalid. */
export function toPhoneValue(raw: string | null | undefined, defaultCountry: CountryCode = "US"): PhoneValue | null {
  const cleaned = cleanPhone(raw);
  if (!cleaned) return null;
  const e164 = normalizePhoneE164(cleaned, defaultCountry);
  if (!e164) return null;
  return { display: cleaned, e164 };
}

/** Supported default-country codes for imports (kept small + explicit). */
export const SUPPORTED_COUNTRIES: Array<{ code: CountryCode; label: string }> = [
  { code: "US", label: "United States (+1)" },
  { code: "CA", label: "Canada (+1)" },
  { code: "GB", label: "United Kingdom (+44)" },
  { code: "AU", label: "Australia (+61)" },
  { code: "MX", label: "Mexico (+52)" },
];

export function isSupportedCountry(code: string): code is CountryCode {
  return SUPPORTED_COUNTRIES.some((c) => c.code === code);
}
