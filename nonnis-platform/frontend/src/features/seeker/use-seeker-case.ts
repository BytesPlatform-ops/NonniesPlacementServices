"use client";

import { useSearchParams } from "next/navigation";

/**
 * The case the family member is currently viewing, or undefined to let the
 * server choose their only one.
 *
 * Deliberately read from the URL rather than stored: it keeps every seeker page
 * shareable and bookmarkable, and there is no client state to fall out of step
 * with what the server authorizes.
 */
export function useSeekerCaseId(): string | undefined {
  const params = useSearchParams();
  return params.get("caseId") ?? undefined;
}
