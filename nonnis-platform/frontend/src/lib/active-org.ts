/**
 * The active organization id for organization-scoped API requests. Held in
 * memory and mirrored to localStorage so the API client can attach the
 * X-Organization-Id header centrally. The backend always re-validates it.
 */
const STORAGE_KEY = "nonnis.activeOrg";
let current: string | null = null;

export function getActiveOrg(): string | null {
  if (current) return current;
  if (typeof window !== "undefined") {
    try {
      current = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  return current;
}

export function setActiveOrg(id: string | null): void {
  current = id;
  if (typeof window !== "undefined") {
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}
