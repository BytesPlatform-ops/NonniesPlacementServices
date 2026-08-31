import { describe, expect, it } from "vitest";
import { buildApiUrl, DEV_FALLBACK_BASE, extractEnvelope, normalizeOrigin } from "./platform-url";

describe("normalizeOrigin", () => {
  it("keeps a plain origin", () => {
    expect(normalizeOrigin("http://localhost:4000", "development")).toBe("http://localhost:4000");
  });

  it("strips a trailing slash", () => {
    expect(normalizeOrigin("https://api.example.com/", "production")).toBe("https://api.example.com");
  });

  it("strips a trailing /api/v1 (with or without slash) so it is never duplicated", () => {
    expect(normalizeOrigin("https://api.example.com/api/v1", "production")).toBe("https://api.example.com");
    expect(normalizeOrigin("https://api.example.com/api/v1/", "production")).toBe("https://api.example.com");
  });

  it("falls back to the local backend in development when unset", () => {
    expect(normalizeOrigin(undefined, "development")).toBe(DEV_FALLBACK_BASE);
    expect(normalizeOrigin("   ", undefined)).toBe(DEV_FALLBACK_BASE);
  });

  it("returns null in production when unset (no localhost fallback)", () => {
    expect(normalizeOrigin(undefined, "production")).toBeNull();
  });
});

describe("buildApiUrl", () => {
  it("builds a full /api/v1 URL, adding a leading slash", () => {
    expect(buildApiUrl("http://localhost:4000", "/public/blog")).toBe("http://localhost:4000/api/v1/public/blog");
    expect(buildApiUrl("http://localhost:4000", "public/blog")).toBe("http://localhost:4000/api/v1/public/blog");
  });

  it("never duplicates /api/v1 through the full pipeline", () => {
    const origin = normalizeOrigin("https://api.example.com/api/v1/", "production");
    expect(buildApiUrl(origin, "/public/testimonials")).toBe("https://api.example.com/api/v1/public/testimonials");
  });

  it("returns null with no origin", () => {
    expect(buildApiUrl(null, "/public/blog")).toBeNull();
  });
});

describe("extractEnvelope", () => {
  it("returns the data of a { data } envelope", () => {
    expect(extractEnvelope<{ items: number[] }>({ data: { items: [1, 2] } })).toEqual({ items: [1, 2] });
  });

  it("treats non-200-shaped / malformed bodies as failures (null)", () => {
    expect(extractEnvelope({ data: null })).toBeNull();
    expect(extractEnvelope({})).toBeNull();
    expect(extractEnvelope(null)).toBeNull();
    expect(extractEnvelope("oops")).toBeNull();
  });
});
