/**
 * URL-safe slug helpers for blog posts. Pure and unit-tested. Slugs are the
 * stable public URL key for an article, so they are validated strictly.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

/** Derive a URL-safe slug from arbitrary text (e.g. a title). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** True when a slug is already well-formed and within length. */
export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}
