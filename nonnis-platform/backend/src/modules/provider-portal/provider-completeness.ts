/**
 * Deterministic, transparent provider-profile completeness. This is NOT a
 * quality score, provider rating, or matching score — it only reports which
 * pieces of the provider's own operational information are present or missing.
 */

export interface CompletenessInput {
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  activeServices: number;
  activeCoverage: number;
  activePaymentTypes: number;
  activeLanguages: number;
  hoursConfigured: number;
  capacityConfigured: number;
}

export interface CompletenessCheck {
  code: string;
  label: string;
  ok: boolean;
}

export interface ProviderCompleteness {
  percentage: number;
  checks: CompletenessCheck[];
  missing: string[];
}

export function computeProviderCompleteness(input: CompletenessInput): ProviderCompleteness {
  const hasContact = Boolean((input.phone || input.email) && (input.city || input.state));
  const checks: CompletenessCheck[] = [
    { code: "PROFILE_CONTACT_MISSING", label: "Contact information & location", ok: hasContact },
    { code: "NO_SERVICES", label: "At least one active service", ok: input.activeServices > 0 },
    { code: "NO_COVERAGE", label: "Geographic coverage", ok: input.activeCoverage > 0 },
    { code: "NO_PAYMENT_TYPES", label: "Accepted payment / insurance", ok: input.activePaymentTypes > 0 },
    { code: "NO_LANGUAGES", label: "Supported languages", ok: input.activeLanguages > 0 },
    { code: "NO_HOURS", label: "Operating hours", ok: input.hoursConfigured > 0 },
    { code: "CAPACITY_UNKNOWN", label: "Current capacity reported", ok: input.capacityConfigured > 0 },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  return {
    percentage: Math.round((okCount / checks.length) * 100),
    checks,
    missing: checks.filter((c) => !c.ok).map((c) => c.code),
  };
}
