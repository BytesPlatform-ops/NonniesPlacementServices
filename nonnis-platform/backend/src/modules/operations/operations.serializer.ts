import { Prisma } from "@prisma/client";
import { caseSummaryInclude, toCaseSummary, type CaseSummary } from "../cases/cases.serializer";

export const operationsCaseInclude = {
  ...caseSummaryInclude,
  organization: { select: { id: true, name: true } },
} satisfies Prisma.CaseInclude;

export type OperationsCaseRow = Prisma.CaseGetPayload<{ include: typeof operationsCaseInclude }>;

export interface OperationsCaseSummary extends CaseSummary {
  organization: { id: string; name: string };
  blocked: boolean;
}

export function toOperationsCaseSummary(row: OperationsCaseRow, now: Date): OperationsCaseSummary {
  return {
    ...toCaseSummary(row, now),
    organization: { id: row.organization.id, name: row.organization.name },
    blocked: row.blocked,
  };
}

export const recentActivityInclude = {
  case: { select: { id: true, caseNumber: true } },
  organization: { select: { id: true, name: true } },
  actorUser: { select: { id: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.WorkflowEventInclude;

export type RecentActivityRow = Prisma.WorkflowEventGetPayload<{ include: typeof recentActivityInclude }>;

export interface RecentActivityView {
  id: string;
  type: string;
  caseId: string;
  caseNumber: string;
  organizationName: string;
  previousStatus: string | null;
  newStatus: string | null;
  actor: string | null;
  createdAt: string;
}

export function toRecentActivityView(row: RecentActivityRow): RecentActivityView {
  const actor = row.actorUser
    ? row.actorUser.displayName || `${row.actorUser.firstName ?? ""} ${row.actorUser.lastName ?? ""}`.trim() || null
    : null;
  return {
    id: row.id,
    type: row.type,
    caseId: row.case.id,
    caseNumber: row.case.caseNumber,
    organizationName: row.organization.name,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actor,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface AssigneeView {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}
