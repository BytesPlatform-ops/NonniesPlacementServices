import { randomUUID } from "node:crypto";

/**
 * RFC-5322 threading helpers. Provider-independent: the resulting Message-ID /
 * In-Reply-To / References values are passed to the transport as ordinary headers,
 * never through Brevo-specific code.
 */

/** Generate one Internet Message-ID (`<uuid@domain>`) we control for an outbound email. */
export function generateInternetMessageId(domain: string): string {
  const host = (domain || "nonnis.local").replace(/[^a-zA-Z0-9.-]/g, "") || "nonnis.local";
  return `<${randomUUID()}@${host}>`;
}

const RE_PREFIX = /^\s*(re|aw|sv|antw|ref)\s*:\s*/i;

/**
 * Normalize a reply subject to a single "Re: " prefix — never "Re: Re: Re:".
 * A blank base subject becomes "Re: (no subject)".
 */
export function normalizeReplySubject(subject: string | null | undefined): string {
  let base = (subject ?? "").trim();
  // Strip any stack of reply prefixes the base already carries.
  while (RE_PREFIX.test(base)) base = base.replace(RE_PREFIX, "").trim();
  if (!base) base = "(no subject)";
  return `Re: ${base}`;
}

const MAX_REFERENCES = 20;

/**
 * Build a bounded, standards-compatible References chain for an outbound reply:
 * the prior chain plus the message we are replying to, de-duplicated, keeping the
 * FIRST (root) reference and the most recent tail when truncation is required.
 */
export function buildReferencesChain(priorReferences: string | null | undefined, inReplyToId: string | null | undefined): string | null {
  const ids: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const m of raw.match(/<[^>]+>/g) ?? []) {
      if (!ids.includes(m)) ids.push(m);
    }
  };
  push(priorReferences);
  push(inReplyToId);
  if (ids.length === 0) return null;
  if (ids.length <= MAX_REFERENCES) return ids.join(" ");
  // Preserve the conversation root + the newest tail (RFC 5322 §3.6.4 guidance).
  const root = ids[0]!;
  const tail = ids.slice(ids.length - (MAX_REFERENCES - 1));
  return [root, ...tail].join(" ");
}
