/**
 * CSV generation for administrative report exports.
 *
 * Two safety concerns are handled here and must never be relaxed:
 *  1. RFC-4180 escaping (quotes/commas/newlines) so values never corrupt the grid.
 *  2. Spreadsheet formula-injection: a value that a spreadsheet would interpret as
 *     a formula (leading =, +, -, @, or the tab/CR control leads) is neutralised so
 *     opening the file in Excel/Sheets can never execute it.
 */

/** Hard cap on rows a single synchronous export may contain. */
export const MAX_EXPORT_ROWS = 10_000;

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Neutralise a single cell against spreadsheet formula injection, then RFC-4180
 * quote it. A dangerous leading character is prefixed with a single quote so the
 * spreadsheet treats the whole cell as text.
 */
export function sanitizeCsvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) {
    text = "";
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === "boolean") {
    text = value ? "Yes" : "No";
  } else {
    text = String(value);
  }

  // Formula-injection guard: prefix a leading formula trigger with a quote.
  if (FORMULA_LEAD.test(text)) {
    text = `'${text}`;
  }

  // RFC-4180 quoting: wrap in quotes and double embedded quotes when needed.
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build a full CSV document (UTF-8 with BOM) from stable headers + rows. */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines: string[] = [];
  lines.push(headers.map(sanitizeCsvCell).join(","));
  for (const row of rows) {
    lines.push(row.map(sanitizeCsvCell).join(","));
  }
  // Prepend a UTF-8 BOM so Excel opens non-ASCII text correctly.
  return "﻿" + lines.join("\r\n");
}

/** Clean, dated export filename, e.g. `nonnis-cases-2026-09-01.csv`. */
export function csvFilename(reportType: string, now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `nonnis-${reportType}-${date}.csv`;
}
