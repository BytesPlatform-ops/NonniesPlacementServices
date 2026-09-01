/**
 * Canonical client-side CSV builder for downloads (e.g. import error rows).
 * Neutralizes spreadsheet formula-injection and applies RFC-4180 quoting.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_LEAD.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(sanitizeCsvCell).join(","));
  return "﻿" + lines.join("\r\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
