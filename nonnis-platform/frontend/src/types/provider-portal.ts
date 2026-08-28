import type { CapacityStatus, ProviderDetailView } from "./providers";

export interface ProviderCompletenessCheck {
  code: string;
  label: string;
  ok: boolean;
}

export interface ProviderCompleteness {
  percentage: number;
  checks: ProviderCompletenessCheck[];
  missing: string[];
}

export interface ProviderPortalSummary {
  servicesCount: number;
  coverageCount: number;
  paymentTypesCount: number;
  languagesCount: number;
  availability: CapacityStatus;
  lastCapacityUpdate: string | null;
}

export interface ProviderPortalMe {
  hasProvider: boolean;
  organizationId: string | null;
  provider: ProviderDetailView | null;
  completeness: ProviderCompleteness | null;
  summary: ProviderPortalSummary | null;
}
