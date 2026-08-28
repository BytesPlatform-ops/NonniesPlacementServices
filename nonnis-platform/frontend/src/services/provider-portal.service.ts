import { apiGet } from "@/lib/api-client";
import type { ProviderPortalMe } from "@/types/provider-portal";

/** Resolve the caller's own provider (from active organization) + dashboard data. */
export function getProviderPortalMe(): Promise<ProviderPortalMe> {
  return apiGet<ProviderPortalMe>("/api/v1/provider-portal/me");
}
