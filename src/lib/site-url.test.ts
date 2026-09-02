import { describe, expect, it } from "vitest";
import { SITE_URL } from "./site-url";

describe("SITE_URL", () => {
  it("is a valid absolute https origin", () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(new URL(SITE_URL).protocol).toBe("https:");
  });

  it("never ships a placeholder or reserved TLD", () => {
    expect(SITE_URL).not.toMatch(/\.(example|invalid|test|local|localhost)(\/|$|:)/);
    expect(SITE_URL).not.toMatch(/example\.(com|org|net)|yourdomain|your-domain|changeme/i);
  });

  it("carries no trailing slash so path concatenation stays correct", () => {
    expect(SITE_URL).not.toMatch(/\/$/);
  });
});
