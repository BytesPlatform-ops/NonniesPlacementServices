import type { InboundOptOutType } from "../providers/sms-inbound-adapter";

/**
 * Conservative fallback keyword classification, used ONLY when the provider did
 * not supply an authoritative `OptOutType` (i.e. Advanced Opt-Out is not enabled
 * on the Messaging Service). It matches Twilio's documented default keyword sets
 * and requires the WHOLE message to be exactly one keyword, case-insensitively,
 * after trimming surrounding whitespace.
 *
 * Deliberately NOT a natural-language classifier: "please stop sending these" is
 * a normal inbound message here, not an opt-out. Twilio's own carrier-level
 * filtering remains the authoritative block either way.
 */
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

export function classifyKeywordFallback(body: string): InboundOptOutType | undefined {
  const word = (body ?? "").trim().toLowerCase();
  if (!word || /\s/.test(word)) return undefined; // must be a single bare keyword
  if (STOP_KEYWORDS.has(word)) return "STOP";
  if (START_KEYWORDS.has(word)) return "START";
  if (HELP_KEYWORDS.has(word)) return "HELP";
  return undefined;
}
