import { csvFilename, MAX_EXPORT_ROWS, sanitizeCsvCell, toCsv } from "./csv";

describe("sanitizeCsvCell (spreadsheet formula injection)", () => {
  it("neutralises leading = + - @ formula triggers", () => {
    expect(sanitizeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvCell("-value")).toBe("'-value");
    expect(sanitizeCsvCell("@formula")).toBe("'@formula");
  });

  it("neutralises leading tab / carriage-return control leads", () => {
    // Tab is a formula lead but not an RFC-quote trigger on its own.
    expect(sanitizeCsvCell("\t=1")).toBe("'\t=1");
    // Carriage return is both neutralised and RFC-quoted.
    expect(sanitizeCsvCell("\r=1")).toBe('"\'\r=1"');
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeCsvCell("Ready for Review")).toBe("Ready for Review");
    expect(sanitizeCsvCell("O'Brien")).toBe("O'Brien");
  });

  it("quotes and escapes commas, quotes and newlines (RFC-4180)", () => {
    expect(sanitizeCsvCell("a,b")).toBe('"a,b"');
    expect(sanitizeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
    expect(sanitizeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders booleans, dates, null and undefined predictably", () => {
    expect(sanitizeCsvCell(true)).toBe("Yes");
    expect(sanitizeCsvCell(false)).toBe("No");
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
    expect(sanitizeCsvCell(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09-01T00:00:00.000Z");
  });

  it("handles a value that is both a formula and contains a comma", () => {
    // Formula prefix applied first, then whole cell quoted because of the comma.
    expect(sanitizeCsvCell("=A1,B1")).toBe('"\'=A1,B1"');
  });
});

describe("toCsv", () => {
  it("emits a BOM, stable headers and CRLF rows", () => {
    const csv = toCsv(["A", "B"], [["1", "2"], ["x,y", "z"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const withoutBom = csv.slice(1);
    expect(withoutBom).toBe('A,B\r\n1,2\r\n"x,y",z');
  });
});

describe("csvFilename", () => {
  it("builds a dated, typed filename", () => {
    expect(csvFilename("cases", new Date("2026-09-01T12:00:00Z"))).toBe("nonnis-cases-2026-09-01.csv");
    expect(csvFilename("form-submissions", new Date("2026-01-05T00:00:00Z"))).toBe("nonnis-form-submissions-2026-01-05.csv");
  });
});

describe("MAX_EXPORT_ROWS", () => {
  it("is a defensible synchronous cap", () => {
    expect(MAX_EXPORT_ROWS).toBe(10_000);
  });
});
