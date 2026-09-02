/**
 * Deterministic SMS encoding + segmentation calculator (GSM 03.38 / UCS-2).
 *
 * Capacities follow current Twilio documentation:
 *   GSM-7  — 160 characters in a single segment, 153 per concatenated segment
 *   UCS-2  —  70 characters in a single segment,  67 per concatenated segment
 * The 7-byte User Data Header on a concatenated message is what reduces 160→153
 * and 70→67; it is already accounted for by those capacities.
 *
 * Two subtleties a naive `Math.ceil(length / 160)` gets wrong and this does not:
 *  - GSM-7 EXTENDED-table characters (^ { } \ [ ~ ] | € and form-feed) are encoded
 *    as an ESC + character pair and therefore cost TWO septets each.
 *  - A character that costs two units (an extended GSM pair, or a UTF-16 surrogate
 *    pair such as an emoji) is never split across a segment boundary, so segments
 *    are packed rather than divided.
 *
 * ESTIMATE, NOT AN INVOICE: some sender types (e.g. certain toll-free/short-code
 * routes) can concatenate differently, and carrier billing varies. This is a
 * conservative general estimate and is always labelled as such in the UI.
 */

/** Twilio accepts up to 1,600 characters for a message body. */
export const MAX_SMS_BODY_CHARS = 1600;

export const GSM7_SINGLE = 160;
export const GSM7_MULTI = 153;
export const UCS2_SINGLE = 70;
export const UCS2_MULTI = 67;

/** GSM 03.38 basic character set (each costs one septet). */
const GSM_BASIC = new Set(
  [
    "@", "£", "$", "¥", "è", "é", "ù", "ì", "ò", "Ç", "\n", "Ø", "ø", "\r", "Å", "å",
    "Δ", "_", "Φ", "Γ", "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "Æ", "æ", "ß", "É",
    " ", "!", '"', "#", "¤", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
    "¡", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ä", "Ö", "Ñ", "Ü", "§",
    "¿", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
    "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "ä", "ö", "ñ", "ü", "à",
  ],
);

/** GSM 03.38 extension table — encoded as ESC + char, so each costs TWO septets. */
const GSM_EXTENDED = new Set(["\f", "^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

export type SmsEncodingName = "GSM7" | "UCS2";

export interface SegmentInfo {
  encoding: SmsEncodingName;
  /** Visible characters (Unicode code points, so an emoji counts as one). */
  characterCount: number;
  /** Encoded units consumed: septets for GSM-7, UTF-16 code units for UCS-2. */
  encodedCharacterUnits: number;
  segmentCount: number;
  /** Free units left in the final segment at the current capacity. */
  charactersRemainingCurrentSegment: number;
  multiSegment: boolean;
  /** Capacity applied to the final segment (single vs concatenated). */
  segmentCapacity: number;
}

/** True when every character is representable in GSM-7 (basic or extended table). */
export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM_BASIC.has(ch) && !GSM_EXTENDED.has(ch)) return false;
  }
  return true;
}

/** Per-character unit costs, in order, for the chosen encoding. */
function unitCosts(text: string, encoding: SmsEncodingName): number[] {
  const costs: number[] = [];
  if (encoding === "GSM7") {
    for (const ch of text) costs.push(GSM_EXTENDED.has(ch) ? 2 : 1);
    return costs;
  }
  // UCS-2: cost is the UTF-16 code-unit length (a surrogate pair costs 2).
  for (const ch of text) costs.push(ch.length);
  return costs;
}

/** Pack costs into segments without ever splitting a two-unit character. */
function pack(costs: number[], single: number, multi: number): { segmentCount: number; usedInLast: number; capacity: number } {
  const total = costs.reduce((a, b) => a + b, 0);
  if (total <= single) return { segmentCount: 1, usedInLast: total, capacity: single };
  let segmentCount = 1;
  let used = 0;
  for (const cost of costs) {
    if (used + cost > multi) {
      segmentCount += 1;
      used = cost;
    } else {
      used += cost;
    }
  }
  return { segmentCount, usedInLast: used, capacity: multi };
}

/** Analyse a message body: encoding, encoded units, and segment count. */
export function calculateSegments(body: string): SegmentInfo {
  const text = body ?? "";
  const encoding: SmsEncodingName = isGsm7(text) ? "GSM7" : "UCS2";
  const costs = unitCosts(text, encoding);
  const encodedCharacterUnits = costs.reduce((a, b) => a + b, 0);
  const { segmentCount, usedInLast, capacity } = pack(
    costs,
    encoding === "GSM7" ? GSM7_SINGLE : UCS2_SINGLE,
    encoding === "GSM7" ? GSM7_MULTI : UCS2_MULTI,
  );
  return {
    encoding,
    characterCount: [...text].length,
    encodedCharacterUnits,
    segmentCount: text.length === 0 ? 0 : segmentCount,
    charactersRemainingCurrentSegment: Math.max(0, capacity - usedInLast),
    multiSegment: segmentCount > 1 && text.length > 0,
    segmentCapacity: capacity,
  };
}
