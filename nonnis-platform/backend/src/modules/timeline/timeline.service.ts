import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type MessageScope, type WorkflowEventType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

export type TimelineFilter = "all" | "case" | "tasks" | "messages" | "referrals";

export interface TimelineItem {
  id: string;
  source: "event" | "message";
  type: string;
  category: string;
  occurredAt: string;
  actor: string | null;
  title: string;
  detail: string | null;
}

const REFERRAL_TYPES: WorkflowEventType[] = [
  "PROVIDER_SELECTION_STARTED",
  "REFERRAL_CREATED",
  "REFERRAL_SENT",
  "REFERRAL_VIEWED",
  "REFERRAL_INFORMATION_REQUESTED",
  "REFERRAL_INFORMATION_PROVIDED",
  "REFERRAL_CONDITIONALLY_ACCEPTED",
  "REFERRAL_ACCEPTED",
  "REFERRAL_DECLINED",
  "REFERRAL_WITHDRAWN",
  "REFERRAL_NOTIFICATION_SENT",
  "REFERRAL_NOTIFICATION_FAILED",
  "PLACEMENT_CREATED",
  "SERVICE_START_SCHEDULED",
  "SERVICE_STARTED",
  "SERVICE_START_UNSUCCESSFUL",
];
const TASK_TYPES: WorkflowEventType[] = ["TASK_CREATED", "TASK_ASSIGNED", "TASK_REASSIGNED", "TASK_STARTED", "TASK_COMPLETED", "TASK_CANCELLED", "TASK_UPDATED"];
const CASE_TYPES: WorkflowEventType[] = [
  "CASE_CREATED",
  "CASE_UPDATED",
  "STATUS_CHANGED",
  "CASE_ASSIGNED",
  "CASE_REASSIGNED",
  "CASE_UNASSIGNED",
  "REQUIREMENT_ADDED",
  "REQUIREMENT_UPDATED",
  "REQUIREMENT_STATUS_CHANGED",
  "SERVICE_REQUEST_ADDED",
  "SERVICE_REQUEST_UPDATED",
  "SERVICE_REQUEST_REMOVED",
  "NOTE_ADDED",
  "CASE_CANCELLED",
];

function categoryFor(type: WorkflowEventType): string {
  if (TASK_TYPES.includes(type)) return "task";
  if (REFERRAL_TYPES.includes(type)) return "referral";
  if (type.startsWith("REQUIREMENT_")) return "requirement";
  if (type.startsWith("SERVICE_REQUEST_")) return "service_request";
  return "case";
}

function personName(u: { displayName: string | null; firstName: string | null; lastName: string | null } | null): string | null {
  if (!u) return null;
  return u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || null;
}

/**
 * One viewer-aware case activity history: merges WorkflowEvents with case
 * messages the viewer is authorized to see. Nonnis-internal notes are only
 * included for internal_notes.manage holders. Providers never reach this
 * endpoint (it requires cases.read, which provider roles lack).
 */
@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  private memberOf(user: RequestUser, organizationId: string): boolean {
    return user.memberships.some((m) => m.organizationId === organizationId);
  }

  async build(user: RequestUser, caseId: string, filter: TimelineFilter, page: number, pageSize: number): Promise<PaginatedResult<TimelineItem>> {
    const c = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.CASES_READ_ALL);
    if (!readAll && !this.memberOf(user, c.organizationId)) throw new NotFoundException(`Case ${caseId} not found`);

    const scopes: MessageScope[] = ["CASE_TEAM", "PROVIDER_REFERRAL"];
    if (user.activePermissions.has(PERMISSIONS.INTERNAL_NOTES_MANAGE)) scopes.push("NONNIS_INTERNAL");

    const { eventTypes, messageScopes } = this.resolveFilter(filter, scopes);
    const limit = page * pageSize;

    const eventWhere: Prisma.WorkflowEventWhereInput = { caseId, ...(eventTypes ? { type: { in: eventTypes } } : {}) };
    const messageWhere: Prisma.MessageWhereInput | null = messageScopes.length > 0 ? { caseId, scope: { in: messageScopes } } : null;

    const [events, eventTotal, messages, messageTotal] = await this.prisma.$transaction([
      eventTypes && eventTypes.length === 0
        ? this.prisma.workflowEvent.findMany({ where: { id: "___none___" } })
        : this.prisma.workflowEvent.findMany({
            where: eventWhere,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { actorUser: { select: { displayName: true, firstName: true, lastName: true } } },
          }),
      eventTypes && eventTypes.length === 0 ? this.prisma.workflowEvent.count({ where: { id: "___none___" } }) : this.prisma.workflowEvent.count({ where: eventWhere }),
      messageWhere ? this.prisma.message.findMany({ where: messageWhere, orderBy: { createdAt: "desc" }, take: limit }) : this.prisma.workflowEvent.findMany({ where: { id: "___none___" } }),
      messageWhere ? this.prisma.message.count({ where: messageWhere }) : this.prisma.workflowEvent.count({ where: { id: "___none___" } }),
    ]);

    const senderNames = messageWhere ? await this.resolveNames((messages as Array<{ senderUserId: string }>).map((m) => m.senderUserId)) : new Map<string, string | null>();

    const eventItems: TimelineItem[] = (events as Array<Prisma.WorkflowEventGetPayload<{ include: { actorUser: { select: { displayName: true; firstName: true; lastName: true } } } }>>).map((e) => ({
      id: e.id,
      source: "event",
      type: e.type,
      category: categoryFor(e.type),
      occurredAt: e.createdAt.toISOString(),
      actor: personName(e.actorUser),
      title: e.type,
      detail: e.type === "STATUS_CHANGED" && e.previousStatus && e.newStatus ? `${e.previousStatus} -> ${e.newStatus}` : null,
    }));

    const messageItems: TimelineItem[] = messageWhere
      ? (messages as Array<{ id: string; scope: MessageScope; senderUserId: string; body: string; createdAt: Date }>).map((m) => ({
          id: m.id,
          source: "message",
          type: m.scope,
          category: "message",
          occurredAt: m.createdAt.toISOString(),
          actor: senderNames.get(m.senderUserId) ?? null,
          title: m.scope,
          detail: m.body,
        }))
      : [];

    const merged = [...eventItems, ...messageItems].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const total = eventTotal + messageTotal;
    const items = merged.slice((page - 1) * pageSize, page * pageSize);

    return { items, page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
  }

  private resolveFilter(filter: TimelineFilter, scopes: MessageScope[]): { eventTypes: WorkflowEventType[] | undefined; messageScopes: MessageScope[] } {
    switch (filter) {
      case "tasks":
        return { eventTypes: TASK_TYPES, messageScopes: [] };
      case "referrals":
        return { eventTypes: REFERRAL_TYPES, messageScopes: scopes.includes("PROVIDER_REFERRAL") ? ["PROVIDER_REFERRAL"] : [] };
      case "messages":
        return { eventTypes: [], messageScopes: scopes };
      case "case":
        return { eventTypes: CASE_TYPES, messageScopes: [] };
      case "all":
      default:
        return { eventTypes: undefined, messageScopes: scopes };
    }
  }

  private async resolveNames(ids: string[]): Promise<Map<string, string | null>> {
    const list = Array.from(new Set(ids));
    const map = new Map<string, string | null>();
    if (list.length === 0) return map;
    const users = await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, displayName: true, firstName: true, lastName: true, email: true } });
    for (const u of users) map.set(u.id, u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
    return map;
  }
}
