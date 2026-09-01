import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, toCsv } from "./csv";

describe("client csv sanitizer", () => {
  it("neutralizes formula-injection leads", () => {
    expect(sanitizeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(sanitizeCsvCell("+1")).toBe("'+1");
    expect(sanitizeCsvCell("-1")).toBe("'-1");
    expect(sanitizeCsvCell("@x")).toBe("'@x");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(sanitizeCsvCell("a,b")).toBe('"a,b"');
    expect(sanitizeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
  });
  it("builds a BOM-prefixed document", () => {
    const csv = toCsv(["A", "B"], [["1", "x,y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('A,B\r\n1,"x,y"');
  });
});
