import { describe, expect, it } from "vitest";
import { formatDate, humanizeEnum } from "./format";
import { CASE_STATUS_ORDER, caseStatusMeta } from "./case-status";

describe("humanizeEnum", () => {
  it("converts UPPER_SNAKE_CASE to Title Case", () => {
    expect(humanizeEnum("READY_FOR_REVIEW")).toBe("Ready For Review");
    expect(humanizeEnum("HOME_HEALTH")).toBe("Home Health");
    expect(humanizeEnum("DRAFT")).toBe("Draft");
  });
});

describe("formatDate", () => {
  it("returns a dash for null or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid ISO date", () => {
    expect(formatDate("2026-03-14T00:00:00.000Z")).toContain("2026");
  });
});

describe("caseStatusMeta", () => {
  it("provides a non-empty label and tone for every status", () => {
    for (const status of CASE_STATUS_ORDER) {
      const meta = caseStatusMeta(status);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.tone).toBeTruthy();
    }
  });
});
