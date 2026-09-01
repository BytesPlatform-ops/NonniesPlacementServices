import "server-only";
import { platformApiUrl } from "./platform-api";

export interface UnsubscribeStatus {
  valid: boolean;
  email?: string | null;
  alreadyUnsubscribed?: boolean;
}

/** Verify an unsubscribe token (server-side). */
export async function fetchUnsubscribeStatus(token: string): Promise<UnsubscribeStatus> {
  const url = platformApiUrl(`/public/communications/unsubscribe?token=${encodeURIComponent(token)}`);
  if (!url) return { valid: false };
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return { valid: false };
    const body = (await res.json()) as { data?: UnsubscribeStatus };
    return body.data ?? { valid: false };
  } catch {
    return { valid: false };
  }
}

/** Perform the unsubscribe (server-side, from a server action). Idempotent. */
export async function submitUnsubscribe(token: string): Promise<{ ok: boolean }> {
  const url = platformApiUrl(`/public/communications/unsubscribe?token=${encodeURIComponent(token)}`);
  if (!url) return { ok: false };
  try {
    const res = await fetch(url, { method: "POST", cache: "no-store", headers: { "content-type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token }) });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { data?: { ok: boolean } };
    return body.data ?? { ok: false };
  } catch {
    return { ok: false };
  }
}
