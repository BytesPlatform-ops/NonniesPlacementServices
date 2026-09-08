import { describe, expect, it } from "vitest";
import { resolvePublicSiteUrl } from "./config";

const PROD = "https://nonnisplacement.com";
const DEV = "http://localhost:3000";

describe("resolvePublicSiteUrl", () => {
  it("uses the configured value when one is set", () => {
    expect(resolvePublicSiteUrl("https://staging.nonnisplacement.com", "production")).toBe(
      "https://staging.nonnisplacement.com",
    );
    expect(resolvePublicSiteUrl(DEV, "development")).toBe(DEV);
  });

  it("strips trailing slashes so a path can be appended directly", () => {
    expect(resolvePublicSiteUrl("https://nonnisplacement.com/", "production")).toBe(PROD);
    expect(resolvePublicSiteUrl("https://nonnisplacement.com///", "production")).toBe(PROD);
  });

  it("trims surrounding whitespace pasted into a host's env editor", () => {
    expect(resolvePublicSiteUrl("  https://nonnisplacement.com  ", "production")).toBe(PROD);
  });

  // The actual production bug: the variable was absent, and the only default
  // was localhost, so the deployed admin panel linked to a developer machine.
  it("defaults to the production site in a production build", () => {
    expect(resolvePublicSiteUrl(undefined, "production")).toBe(PROD);
  });

  it("treats a blank or whitespace-only value as unset", () => {
    expect(resolvePublicSiteUrl("", "production")).toBe(PROD);
    expect(resolvePublicSiteUrl("   ", "production")).toBe(PROD);
    expect(resolvePublicSiteUrl("", "development")).toBe(DEV);
  });

  it("keeps localhost for development and test builds", () => {
    expect(resolvePublicSiteUrl(undefined, "development")).toBe(DEV);
    expect(resolvePublicSiteUrl(undefined, "test")).toBe(DEV);
    expect(resolvePublicSiteUrl(undefined, undefined)).toBe(DEV);
  });

  it("never returns a trailing slash, so building a link cannot double up", () => {
    for (const env of ["production", "development", undefined]) {
      expect(resolvePublicSiteUrl(undefined, env)).not.toMatch(/\/$/);
    }
  });
});
