import type { ResidentialProviderQuery } from "./content";

/**
 * Pure query-string builder for the public residential-provider list request.
 * Kept separate from the `server-only` content fetchers so it is unit-testable
 * and can never accidentally leak empty/default params into the URL.
 */
export function buildDirectoryQuery(params: ResidentialProviderQuery = {}): string {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.state) q.set("state", params.state);
  if (params.city) q.set("city", params.city);
  if (params.serviceCategory) q.set("serviceCategory", params.serviceCategory);
  if (params.language) q.set("language", params.language);
  if (params.paymentType) q.set("paymentType", params.paymentType);
  if (params.sort) q.set("sort", params.sort);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 12));
  return q.toString();
}
