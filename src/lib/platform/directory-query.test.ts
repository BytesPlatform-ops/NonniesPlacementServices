import { describe, expect, it } from "vitest";
import { buildDirectoryQuery } from "./directory-query";

describe("buildDirectoryQuery", () => {
  it("always sets a default limit and omits page 1", () => {
    expect(buildDirectoryQuery()).toBe("limit=12");
    expect(buildDirectoryQuery({ page: 1 })).toBe("limit=12");
  });

  it("includes page only when > 1", () => {
    expect(buildDirectoryQuery({ page: 3 })).toBe("page=3&limit=12");
  });

  it("drops empty/undefined filters and keeps set ones", () => {
    const qs = buildDirectoryQuery({ q: "sunrise", state: "WA", serviceCategory: "cat-1", city: "", language: undefined });
    const params = new URLSearchParams(qs);
    expect(params.get("q")).toBe("sunrise");
    expect(params.get("state")).toBe("WA");
    expect(params.get("serviceCategory")).toBe("cat-1");
    expect(params.has("city")).toBe(false);
    expect(params.has("language")).toBe(false);
  });

  it("honours a custom limit and sort", () => {
    expect(buildDirectoryQuery({ limit: 48, sort: "name" })).toContain("limit=48");
    expect(buildDirectoryQuery({ sort: "recent" })).toContain("sort=recent");
  });
});
