/**
 * A per-submission key so a double-click, a browser retry or a flaky network can
 * never queue the same message twice. The backend enforces it with a unique index;
 * this just supplies a stable value across retries of the SAME submission.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
