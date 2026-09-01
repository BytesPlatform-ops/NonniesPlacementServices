import type { ProviderStatus } from "@prisma/client";

/**
 * Deterministic rules for the public residential directory. A provider is
 * publicly visible only when it is ACTIVE, explicitly marked residential, and
 * explicitly published by Nonnis staff — never automatically.
 */

/** URL-safe slug shape: lowercase words joined by single hyphens. */
export const PUBLIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Best-effort slug from a display name (callers still ensure uniqueness). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export interface PublicListingCandidate {
  isResidentialProvider: boolean;
  status: ProviderStatus;
  displayName: string | null;
  publicSlug: string | null;
  city: string | null;
  state: string | null;
  activeServicesCount: number;
}

/**
 * Structured list of what still blocks publication. Empty array = ready. These
 * are the MINIMUM public-profile requirements — no irrelevant fields.
 */
export function publicListingMissing(c: PublicListingCandidate): string[] {
  const missing: string[] = [];
  if (!c.isResidentialProvider) missing.push("Mark the provider as a residential provider");
  if (c.status !== "ACTIVE") missing.push("Provider status must be Active");
  if (!c.displayName || !c.displayName.trim()) missing.push("A public display name");
  if (!c.publicSlug || !PUBLIC_SLUG_RE.test(c.publicSlug)) missing.push("A valid public URL slug");
  if (!c.city || !c.city.trim() || !c.state || !c.state.trim()) missing.push("A city and state");
  if (c.activeServicesCount < 1) missing.push("At least one active service");
  return missing;
}

export function publicListingReady(c: PublicListingCandidate): boolean {
  return publicListingMissing(c).length === 0;
}
