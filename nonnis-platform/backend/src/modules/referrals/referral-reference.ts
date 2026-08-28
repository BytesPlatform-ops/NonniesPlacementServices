import { randomBytes } from "node:crypto";

/**
 * Generates a stable, user-facing referral reference: REF-<year>-XXXXXX (6 hex).
 * The UUID remains the database primary key; this is display/search only. The
 * random suffix + a unique DB constraint make collisions astronomically unlikely
 * (callers retry on a unique violation).
 */
export function generateReferralReference(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `REF-${year}-${suffix}`;
}
