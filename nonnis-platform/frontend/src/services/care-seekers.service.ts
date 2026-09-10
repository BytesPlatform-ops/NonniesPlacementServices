import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
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

/**
 * Send a pending family invitation again, leaving the grant untouched.
 * `emailKind` says which email went out — an invitation, or a password-setup
 * link when the address was already registered by an earlier attempt.
 */
export function resendCareSeekerInvitation(
  caseId: string,
  accessId: string,
): Promise<{ accessId: string; email: string; emailKind: string }> {
  return apiPost<{ accessId: string; email: string; emailKind: string }>(
    `/api/v1/cases/${caseId}/care-seekers/${accessId}/resend-invitation`,
  );
}

/**
 * Remove a pending invitation, and the account behind it when it exists for
 * nothing else, so the address is free to invite again. Only for an invitation
 * that never landed — revoking is the tool for access that should end.
 */
export function removeCareSeekerInvitation(
  caseId: string,
  accessId: string,
): Promise<{ id: string; accountRemoved: boolean }> {
  return apiDelete<{ id: string; accountRemoved: boolean }>(
    `/api/v1/cases/${caseId}/care-seekers/${accessId}`,
  );
}
