import { buildDateRange, humanizeEnum, skipTake, sortField, sortOrder, totalPages } from "./report-shared";

describe("buildDateRange", () => {
  it("returns undefined when neither bound is set", () => {
    expect(buildDateRange(undefined, undefined)).toBeUndefined();
    expect(buildDateRange("", "")).toBeUndefined();
  });

  it("uses UTC midnight for the lower bound", () => {
    const r = buildDateRange("2026-09-01", undefined)!;
    expect(r.gte).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(r.lt).toBeUndefined();
  });

  it("makes the upper bound inclusive of the whole day (exclusive next midnight)", () => {
    const r = buildDateRange(undefined, "2026-09-30")!;
    expect(r.lt).toEqual(new Date(Date.UTC(2026, 9, 1)));
    expect(r.gte).toBeUndefined();
  });

  it("ignores malformed dates", () => {
    expect(buildDateRange("2026/09/01", "nonsense")).toBeUndefined();
  });
});

describe("humanizeEnum", () => {
  it("title-cases underscored enum codes", () => {
    expect(humanizeEnum("READY_FOR_REVIEW")).toBe("Ready For Review");
    expect(humanizeEnum("IN_PROGRESS")).toBe("In Progress");
    expect(humanizeEnum("ACCEPTED")).toBe("Accepted");
  });

  it("returns an empty string for empty input", () => {
    expect(humanizeEnum(null)).toBe("");
    expect(humanizeEnum(undefined)).toBe("");
  });
});

describe("sortField / sortOrder", () => {
  it("whitelists sort fields with a fallback", () => {
    expect(sortField("createdAt", ["createdAt", "status"], "status")).toBe("createdAt");
    expect(sortField("evil; DROP", ["createdAt", "status"], "status")).toBe("status");
    expect(sortField(undefined, ["createdAt"], "createdAt")).toBe("createdAt");
  });

  it("defaults order to desc unless asc is requested", () => {
    expect(sortOrder("asc")).toBe("asc");
    expect(sortOrder("desc")).toBe("desc");
    expect(sortOrder(undefined)).toBe("desc");
    expect(sortOrder("garbage")).toBe("desc");
  });
});

describe("skipTake / totalPages", () => {
  it("computes skip/take from page and pageSize", () => {
    expect(skipTake({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(skipTake({ page: 3, pageSize: 25 })).toEqual({ skip: 50, take: 25 });
  });

  it("computes total pages, returning 0 for an empty set", () => {
    expect(totalPages(0, 20)).toBe(0);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(40, 20)).toBe(2);
  });
});
