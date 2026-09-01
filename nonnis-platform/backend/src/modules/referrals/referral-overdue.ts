import { Prisma, type ReferralStatus } from "@prisma/client";

/**
 * Single definition of an "overdue" referral, shared by the referral queues and
 * the administrative referral report so the meaning never diverges: a referral
 * still awaiting a provider response whose response-by date has passed.
 */
export const REFERRAL_OVERDUE_STATUSES: ReferralStatus[] = [
  "SENT",
  "VIEWED",
  "INFORMATION_REQUESTED",
  "CONDITIONALLY_ACCEPTED",
];

export function referralOverdueWhere(now: Date): Prisma.ReferralWhereInput {
  return { responseDueAt: { lt: now }, status: { in: REFERRAL_OVERDUE_STATUSES } };
}
