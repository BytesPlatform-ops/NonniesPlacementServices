import { PUBLIC_SLUG_RE, publicListingMissing, publicListingReady, slugify } from "./public-listing";

describe("slugify", () => {
  it("produces url-safe lowercase hyphenated slugs", () => {
    expect(slugify("Sunrise Senior Living")).toBe("sunrise-senior-living");
    expect(slugify("  Oak & Pine  Home! ")).toBe("oak-pine-home");
    expect(slugify("Café Résidence")).toBe("cafe-residence");
  });
  it("matches PUBLIC_SLUG_RE", () => {
    expect(PUBLIC_SLUG_RE.test(slugify("Sunrise Senior Living"))).toBe(true);
    expect(PUBLIC_SLUG_RE.test("Bad Slug")).toBe(false);
    expect(PUBLIC_SLUG_RE.test("-leading")).toBe(false);
    expect(PUBLIC_SLUG_RE.test("ok-1-2")).toBe(true);
  });
});

describe("publicListingMissing", () => {
  const ready = {
    isResidentialProvider: true,
    status: "ACTIVE" as const,
    displayName: "Sunrise",
    publicSlug: "sunrise",
    city: "Sacramento",
    state: "CA",
    activeServicesCount: 2,
  };

  it("returns empty for a complete active residential provider", () => {
    expect(publicListingMissing(ready)).toEqual([]);
    expect(publicListingReady(ready)).toBe(true);
  });

  it("flags a non-residential provider", () => {
    expect(publicListingMissing({ ...ready, isResidentialProvider: false })).toContain(
      "Mark the provider as a residential provider",
    );
  });

  it("flags a non-active provider", () => {
    expect(publicListingMissing({ ...ready, status: "PAUSED" })).toContain("Provider status must be Active");
    expect(publicListingMissing({ ...ready, status: "INACTIVE" })).toContain("Provider status must be Active");
  });

  it("flags a missing/invalid slug", () => {
    expect(publicListingMissing({ ...ready, publicSlug: null })).toContain("A valid public URL slug");
    expect(publicListingMissing({ ...ready, publicSlug: "Bad Slug" })).toContain("A valid public URL slug");
  });

  it("flags missing location and missing services", () => {
    expect(publicListingMissing({ ...ready, city: null })).toContain("A city and state");
    expect(publicListingMissing({ ...ready, state: "" })).toContain("A city and state");
    expect(publicListingMissing({ ...ready, activeServicesCount: 0 })).toContain("At least one active service");
  });
});
