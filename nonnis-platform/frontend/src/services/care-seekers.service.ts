import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { CareSeekerAccess } from "@/types/seeker";

/** Staff-side management of who has family access to a case. */

export function listCareSeekers(caseId: string): Promise<CareSeekerAccess[]> {
  return apiGet<CareSeekerAccess[]>(`/api/v1/cases/${caseId}/care-seekers`);
}

export function grantCareSeekerAccess(
  caseId: string,
  input: { email: string; firstName?: string; lastName?: string; relationship?: string },
): Promise<CareSeekerAccess> {
  return apiPost<CareSeekerAccess>(`/api/v1/cases/${caseId}/care-seekers`, input);
}

export function setCareSeekerAccessStatus(
  caseId: string,
  accessId: string,
  input: { status: "ACTIVE" | "REVOKED"; reason?: string },
): Promise<CareSeekerAccess> {
  return apiPatch<CareSeekerAccess>(`/api/v1/cases/${caseId}/care-seekers/${accessId}`, input);
}
