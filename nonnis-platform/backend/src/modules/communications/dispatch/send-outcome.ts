/**
 * Channel-agnostic shape of a transport send outcome. Both EmailSendOutcome and
 * SmsSendOutcome satisfy it structurally, so email and SMS share ONE retry policy.
 */
export type SendOutcomeLike =
  | { ok: true; providerMessageId: string; acceptedAt: string }
  | { ok: false; classification: string; code: string; message: string; retryAfterMs?: number };

export const MAX_SEND_ATTEMPTS = 3;

/**
 * The single, shared decision for what to do with a transport send outcome. Email
 * campaigns, email replies, SMS campaigns and SMS replies all use this so the
 * transient-retry / ambiguous-timeout / permanent-failure policy is identical and
 * never duplicated:
 *   - AMBIGUOUS (possible acceptance) → DELIVERY_UNKNOWN, never blind-retry
 *   - RATE_LIMIT / TEMPORARY under the attempt cap → retry with backoff
 *   - anything else (PERMANENT, CONFIGURATION, PROVIDER_OPT_OUT_BLOCK) → permanent
 *     failure, never retried
 */
export type SendAction =
  | { kind: "sent"; providerMessageId: string; acceptedAt: string }
  | { kind: "retry"; attempt: number; backoffMs: number; code: string; message: string }
  | { kind: "unknown"; attempt: number; code: string; message: string }
  | { kind: "failed"; attempt: number; code: string; message: string };

export function classifySendResult(outcome: SendOutcomeLike, priorAttemptCount: number, maxAttempts = MAX_SEND_ATTEMPTS): SendAction {
  if (outcome.ok) {
    return { kind: "sent", providerMessageId: outcome.providerMessageId, acceptedAt: outcome.acceptedAt };
  }
  const attempt = priorAttemptCount + 1;
  if (outcome.classification === "AMBIGUOUS") {
    return { kind: "unknown", attempt, code: outcome.code, message: outcome.message };
  }
  const retryable = outcome.classification === "RATE_LIMIT" || outcome.classification === "TEMPORARY";
  if (retryable && attempt < maxAttempts) {
    return { kind: "retry", attempt, backoffMs: outcome.retryAfterMs ?? 5_000 * attempt, code: outcome.code, message: outcome.message };
  }
  return { kind: "failed", attempt, code: outcome.code, message: outcome.message };
}
