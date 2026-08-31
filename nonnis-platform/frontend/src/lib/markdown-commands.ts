/**
 * Pure, selection-aware Markdown editing commands. Each takes the current text
 * and selection and returns the new text + selection — no DOM, fully testable.
 * The editor component wires these to toolbar buttons and keyboard shortcuts.
 */

export interface EditorState {
  value: string;
  selStart: number;
  selEnd: number;
}

function state(value: string, selStart: number, selEnd: number): EditorState {
  return { value, selStart, selEnd };
}

/** Toggle an inline wrapper (e.g. ** for bold) around the selection. */
export function wrapInline(value: string, s: number, e: number, marker: string): EditorState {
  const selected = value.slice(s, e);
  const before = value.slice(0, s);
  const after = value.slice(e);
  const m = marker.length;

  // Already wrapped just inside the selection → unwrap.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= 2 * m) {
    const inner = selected.slice(m, selected.length - m);
    return state(before + inner + after, s, s + inner.length);
  }
  // Already wrapped just outside the selection → unwrap.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return state(before.slice(0, -m) + selected + after.slice(m), s - m, e - m);
  }
  if (selected.length === 0) {
    // No selection: insert markers and place the cursor between them.
    const next = before + marker + marker + after;
    return state(next, s + m, s + m);
  }
  const next = before + marker + selected + marker + after;
  return state(next, s + m, e + m);
}

export const toggleBold = (v: string, s: number, e: number): EditorState => wrapInline(v, s, e, "**");
export const toggleItalic = (v: string, s: number, e: number): EditorState => wrapInline(v, s, e, "*");
export const toggleInlineCode = (v: string, s: number, e: number): EditorState => wrapInline(v, s, e, "`");

/** Expand [s,e] to cover whole lines. */
function lineBounds(value: string, s: number, e: number): { start: number; end: number } {
  let start = s;
  while (start > 0 && value[start - 1] !== "\n") start--;
  let end = e;
  while (end < value.length && value[end] !== "\n") end++;
  return { start, end };
}

const HEADING_RE = /^(#{1,6})\s+/;
const BULLET_RE = /^[-*]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const QUOTE_RE = /^>\s+/;

/** Set (or, when level matches on every line, clear) a heading level on the selected lines. */
export function setHeading(value: string, s: number, e: number, level: 0 | 1 | 2 | 3 | 4 | 5 | 6): EditorState {
  const { start, end } = lineBounds(value, s, e);
  const block = value.slice(start, end);
  const lines = block.split("\n");
  const prefix = level === 0 ? "" : `${"#".repeat(level)} `;

  const allSameLevel =
    level !== 0 && lines.every((l) => l.startsWith(prefix) || l.trim() === "");
  const transformed = lines.map((l) => {
    const bare = l.replace(HEADING_RE, "");
    if (bare.trim() === "") return bare;
    if (allSameLevel) return bare; // toggle off → paragraph
    return `${prefix}${bare}`;
  });
  const nextBlock = transformed.join("\n");
  const next = value.slice(0, start) + nextBlock + value.slice(end);
  return state(next, start, start + nextBlock.length);
}

/** Toggle a line-prefix list/quote over the selected lines. */
function toggleLinePrefix(
  value: string,
  s: number,
  e: number,
  test: RegExp,
  make: (index: number) => string,
): EditorState {
  const { start, end } = lineBounds(value, s, e);
  const block = value.slice(start, end);
  const lines = block.split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  const allPrefixed = nonEmpty.length > 0 && nonEmpty.every((l) => test.test(l));

  let counter = 0;
  const transformed = lines.map((l) => {
    if (l.trim() === "") return l;
    const bare = l.replace(BULLET_RE, "").replace(ORDERED_RE, "").replace(QUOTE_RE, "");
    if (allPrefixed) return bare;
    return `${make(counter++)}${bare}`;
  });
  const nextBlock = transformed.join("\n");
  const next = value.slice(0, start) + nextBlock + value.slice(end);
  return state(next, start, start + nextBlock.length);
}

export const toggleBulletList = (v: string, s: number, e: number): EditorState =>
  toggleLinePrefix(v, s, e, BULLET_RE, () => "- ");

export const toggleOrderedList = (v: string, s: number, e: number): EditorState =>
  toggleLinePrefix(v, s, e, ORDERED_RE, (i) => `${i + 1}. `);

export const toggleBlockquote = (v: string, s: number, e: number): EditorState =>
  toggleLinePrefix(v, s, e, QUOTE_RE, () => "> ");

/** Insert a Markdown link using the selection as the label (or `text`). */
export function insertLink(value: string, s: number, e: number, url: string, text?: string): EditorState {
  const label = (text ?? value.slice(s, e)) || "link";
  const md = `[${label}](${url})`;
  const next = value.slice(0, s) + md + value.slice(e);
  // Place the cursor after the inserted link.
  return state(next, s + md.length, s + md.length);
}

/** Insert a horizontal rule on its own line. */
export function insertHorizontalRule(value: string, s: number, e: number): EditorState {
  const md = "\n\n---\n\n";
  const next = value.slice(0, s) + md + value.slice(e);
  return state(next, s + md.length, s + md.length);
}

/** Strip inline emphasis and line-prefix formatting from the selection. */
export function clearFormatting(value: string, s: number, e: number): EditorState {
  const cleaned = value
    .slice(s, e)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split("\n")
    .map((l) => l.replace(HEADING_RE, "").replace(BULLET_RE, "").replace(ORDERED_RE, "").replace(QUOTE_RE, ""))
    .join("\n");
  return state(value.slice(0, s) + cleaned + value.slice(e), s, s + cleaned.length);
}
