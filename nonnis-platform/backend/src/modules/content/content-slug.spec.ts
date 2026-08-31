import { isValidSlug, slugify, SLUG_MAX_LENGTH } from "./content-slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Planning a Safe Hospital Discharge")).toBe("planning-a-safe-hospital-discharge");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("What's the *right* level of care?!")).toBe("what-s-the-right-level-of-care");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Hello, World--  ")).toBe("hello-world");
  });

  it("removes diacritics", () => {
    expect(slugify("Café Señor")).toBe("cafe-senor");
  });

  it("caps length", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs", () => {
    expect(isValidSlug("a-good-slug")).toBe(true);
    expect(isValidSlug("post-2")).toBe(true);
  });

  it("rejects malformed slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Has Spaces")).toBe(false);
    expect(isValidSlug("Trailing-")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
  });
});
