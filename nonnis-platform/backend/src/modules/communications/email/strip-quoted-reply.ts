/**
 * Trim the quoted history off an inbound email reply.
 *
 * A reply carries the whole conversation beneath it. In a threaded inbox those
 * earlier messages are already shown as their own entries, so repeating them
 * inside every reply buries the few words the person actually wrote.
 *
 * This only ever cuts at a recognised attribution/quote boundary, and refuses
 * to return an empty result — if trimming would leave nothing, the original
 * text is kept. Losing a real message is far worse than showing a quote.
 */

/** Markers that begin the quoted portion of a reply, across common clients. */
const QUOTE_BOUNDARIES: RegExp[] = [
  // "On <date> <someone> wrote:" — Gmail, Apple Mail, most clients. The date
  // may wrap onto the next line, so the trailing "wrote:" is matched loosely.
  /^\s*On .*\bwrote:\s*$/im,
  /^\s*On .*\n?.*\bwrote:\s*$/im,
  // Outlook and older clients.
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^\s*_{5,}\s*$/m,
  /^\s*From:\s.*\n\s*(Sent|Date):\s.*$/im,
  // Common localisations/variants.
  /^\s*Le .*\ba écrit\s*:\s*$/im,
  /^\s*Am .*\bschrieb\s.*:\s*$/im,
];

export function stripQuotedReply(text: string | null | undefined): string {
  if (!text) return "";
  const normalized = text.replace(/\r\n/g, "\n");

  let cut = normalized.length;
  for (const boundary of QUOTE_BOUNDARIES) {
    const match = boundary.exec(normalized);
    if (match && match.index < cut) cut = match.index;
  }

  let body = normalized.slice(0, cut);

  // Drop a trailing run of quoted lines that had no attribution line above it.
  const lines = body.split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!;
    if (last.trim() === "" || last.startsWith(">")) lines.pop();
    else break;
  }
  body = lines.join("\n").trim();

  // Never hand back nothing: a reply that is only a quote is still a reply.
  return body || normalized.trim();
}
