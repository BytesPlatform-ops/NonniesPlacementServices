import { BadRequestException } from "@nestjs/common";
import { ALLOWED_MERGE_FIELDS } from "../email/template-design";
import { MAX_SMS_BODY_CHARS } from "./sms-segments";

/**
 * SMS merge fields reuse the SAME safe contact allow-list as email templates, so
 * there is exactly one place that decides what may be merged into a message.
 * Patient / case / diagnosis / insurance / clinical fields are excluded by
 * construction — the Communications module never touches PHI.
 *
 * SMS bodies are PLAIN TEXT: no HTML, no Markdown. Values are substituted as-is
 * (there is no markup context to escape into).
 */
export const SMS_MERGE_FIELDS = ALLOWED_MERGE_FIELDS;

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface SmsMergeValues {
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  email?: string | null;
}

/** Sample values used for template preview / estimation before a real audience exists. */
export const SAMPLE_SMS_VALUES: SmsMergeValues = {
  firstName: "Jordan",
  lastName: "Rivera",
  organizationName: "Riverside Health",
  email: "jordan@example.com",
};

/** Every merge token present in the body (deduped, in order of appearance). */
export function collectSmsTokens(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(TOKEN_RE)) {
    const token = m[1]!;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

/**
 * Reject unknown merge fields loudly — an unresolved `{{something}}` must never
 * reach a real recipient's handset.
 */
export function assertSmsMergeTokens(body: string): void {
  const unknown = collectSmsTokens(body).filter((t) => !SMS_MERGE_FIELDS.includes(t as (typeof SMS_MERGE_FIELDS)[number]));
  if (unknown.length) {
    throw new BadRequestException(`Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}. Allowed: ${SMS_MERGE_FIELDS.map((f) => `{{${f}}}`).join(", ")}`);
  }
}

/** Validate an SMS body: non-empty, within the provider limit, known merge fields only. */
export function validateSmsBody(body: string): string {
  const trimmed = (body ?? "").trim();
  if (!trimmed) throw new BadRequestException("A message body is required.");
  if (trimmed.length > MAX_SMS_BODY_CHARS) throw new BadRequestException(`The message exceeds the ${MAX_SMS_BODY_CHARS}-character limit.`);
  assertSmsMergeTokens(trimmed);
  return trimmed;
}

/** Substitute allow-listed merge fields; unknown tokens were rejected at validation. */
export function renderSmsBody(body: string, values: SmsMergeValues): string {
  const full = [values.firstName, values.lastName].filter(Boolean).join(" ").trim();
  const map: Record<string, string> = {
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    fullName: full,
    organizationName: values.organizationName ?? "",
    email: values.email ?? "",
  };
  // Collapse whitespace left behind by an empty substitution so a missing first
  // name never produces "Hi  ," on a real handset.
  return body.replace(TOKEN_RE, (_m, token: string) => map[token] ?? "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?])/g, "$1").trim();
}
