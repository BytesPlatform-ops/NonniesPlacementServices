import { parse } from "csv-parse/sync";

/** Bounded import limits — protect the browser and backend from unbounded input. */
export const IMPORT_MAX_ROWS = 25_000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB of text content

/** Split pasted text on newlines, commas and semicolons; trim; drop empties. */
export function splitPasted(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** One value per non-empty line (TXT imports). */
export function parseTxtLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Parse CSV content with a real, maintained parser (never split(",")): it
 * handles quoted commas, escaped quotes and embedded newlines. The first
 * non-empty record is treated as the header row.
 */
export function parseCsvContent(text: string): ParsedCsv {
  const records = parse(text, {
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as string[][];
  if (records.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = records;
  return { headers: headers.map((h) => h ?? ""), rows };
}
