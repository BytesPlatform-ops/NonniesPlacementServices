import type { CaseStatus, Prisma } from "@prisma/client";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";

/**
 * Centralized, conservative case-status maintenance driven by referral/placement
 * activity. A status is only advanced from an explicitly allowed prior state, and
 * terminal/discharge/completed states are never touched here. This is direct
 * business-state maintenance tied to explicit user actions — NOT a workflow
 * automation engine and NOT a matching engine.
 */
export async function applyCaseStatus(
  tx: Prisma.TransactionClient,
  workflowEvents: WorkflowEventsService,
  caseId: string,
  target: CaseStatus,
  allowedFrom: CaseStatus[],
  actorUserId: string | null,
  reason?: string,
): Promise<boolean> {
  const c = await tx.case.findUnique({ where: { id: caseId }, select: { status: true, organizationId: true } });
  if (!c || c.status === target || !allowedFrom.includes(c.status)) return false;
  await tx.case.update({ where: { id: caseId }, data: { status: target } });
  await workflowEvents.record(
    {
      organizationId: c.organizationId,
      caseId,
      type: "STATUS_CHANGED",
      previousStatus: c.status,
      newStatus: target,
      source: "SYSTEM",
      actorUserId,
      metadata: reason ? { reason } : undefined,
    },
    tx,
  );
  return true;
}

/**
 * True when every non-cancelled service request on the case has at least one
 * accepted referral whose placement is not cancelled. Used to decide whether the
 * whole case may move to ACCEPTED — one provider acceptance is never enough on a
 * multi-service-request case.
 */
export async function allServiceRequestsPlaced(tx: Prisma.TransactionClient, caseId: string): Promise<boolean> {
  const requests = await tx.serviceRequest.findMany({
    where: { caseId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (requests.length === 0) return false;
  for (const request of requests) {
    const placed = await tx.referral.findFirst({
      where: { serviceRequestId: request.id, status: "ACCEPTED", placement: { status: { not: "CANCELLED" } } },
      select: { id: true },
    });
    if (!placed) return false;
  }
  return true;
}

/** True when the case still has an active referral awaiting information. */
export async function hasOutstandingInformationRequest(tx: Prisma.TransactionClient, caseId: string): Promise<boolean> {
  const found = await tx.referral.findFirst({
    where: { caseId, status: "INFORMATION_REQUESTED" },
    select: { id: true },
  });
  return found !== null;
}
