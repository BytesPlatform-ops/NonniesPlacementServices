/**
 * Client-side SMS encoding + segmentation, used ONLY for instant feedback while
 * typing. It mirrors the backend calculator (GSM 03.38 / UCS-2) rule for rule:
 *   GSM-7 — 160 in a single segment, 153 per concatenated segment
 *   UCS-2 —  70 in a single segment,  67 per concatenated segment
 * with extended-table characters costing two septets and two-unit characters
 * never split across a segment boundary.
 *
 * The BACKEND remains authoritative: it re-renders and re-counts every recipient
 * at queue time. `sms-segments.test.ts` pins the two implementations together.
 * Always an estimate, never an invoice.
 */
export const MAX_SMS_BODY_CHARS = 1600;

const GSM_BASIC = new Set([
  "@", "£", "$", "¥", "è", "é", "ù", "ì", "ò", "Ç", "\n", "Ø", "ø", "\r", "Å", "å",
  "Δ", "_", "Φ", "Γ", "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "Æ", "æ", "ß", "É",
  " ", "!", '"', "#", "¤", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
  "¡", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
  "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ä", "Ö", "Ñ", "Ü", "§",
  "¿", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
  "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "ä", "ö", "ñ", "ü", "à",
]);
const GSM_EXTENDED = new Set(["\f", "^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

export type SmsEncodingName = "GSM7" | "UCS2";

export interface SegmentInfo {
  encoding: SmsEncodingName;
  characterCount: number;
  encodedCharacterUnits: number;
  segmentCount: number;
  charactersRemainingCurrentSegment: number;
  multiSegment: boolean;
  segmentCapacity: number;
}

export function isGsm7(text: string): boolean {
  for (const ch of text) if (!GSM_BASIC.has(ch) && !GSM_EXTENDED.has(ch)) return false;
  return true;
}

export function calculateSegments(body: string): SegmentInfo {
  const text = body ?? "";
  const encoding: SmsEncodingName = isGsm7(text) ? "GSM7" : "UCS2";
  const costs: number[] = [];
  for (const ch of text) costs.push(encoding === "GSM7" ? (GSM_EXTENDED.has(ch) ? 2 : 1) : ch.length);

  const single = encoding === "GSM7" ? 160 : 70;
  const multi = encoding === "GSM7" ? 153 : 67;
  const total = costs.reduce((a, b) => a + b, 0);

  let segmentCount = 1;
  let used = total;
  let capacity = single;
  if (total > single) {
    capacity = multi;
    segmentCount = 1;
    used = 0;
    for (const cost of costs) {
      if (used + cost > multi) {
        segmentCount += 1;
        used = cost;
      } else {
        used += cost;
      }
    }
  }

  return {
    encoding,
    characterCount: [...text].length,
    encodedCharacterUnits: total,
    segmentCount: text.length === 0 ? 0 : segmentCount,
    charactersRemainingCurrentSegment: Math.max(0, capacity - used),
    multiSegment: segmentCount > 1 && text.length > 0,
    segmentCapacity: capacity,
  };
}
