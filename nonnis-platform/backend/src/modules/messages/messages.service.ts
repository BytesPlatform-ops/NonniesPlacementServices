import { Injectable } from "@nestjs/common";
import { Prisma, type MessageScope } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import type { RequestUser } from "../auth/request-user";
import { MessageAccessService } from "./message-access";
import { toMessageView, type MessageView } from "./messages.serializer";
import type { ListMessagesDto, SendMessageDto } from "./dto/messages.dto";

/**
 * Case-linked messaging. Three visibility scopes (CASE_TEAM / NONNIS_INTERNAL /
 * PROVIDER_REFERRAL) share this append-only service; access is decided by
 * MessageAccessService. Messages are timeline items themselves, so no duplicate
 * WorkflowEvent is emitted. Sender identity is always server-derived.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MessageAccessService,
  ) {}

  private async resolveNames(ids: string[]): Promise<Map<string, string | null>> {
    const list = Array.from(new Set(ids));
    const map = new Map<string, string | null>();
    if (list.length === 0) return map;
    const users = await this.prisma.user.findMany({
      where: { id: { in: list } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    for (const u of users) map.set(u.id, u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
    return map;
  }

  private async page(where: Prisma.MessageWhereInput, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({ where, orderBy: { createdAt: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.message.count({ where }),
    ]);
    const names = await this.resolveNames(rows.map((m) => m.senderUserId));
    return {
      items: rows.map((m) => toMessageView(m, names)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  private async create(caseId: string, scope: MessageScope, senderUserId: string, body: string, referralId?: string): Promise<MessageView> {
    const created = await this.prisma.message.create({ data: { caseId, scope, senderUserId, body, referralId } });
    const names = await this.resolveNames([senderUserId]);
    return toMessageView(created, names);
  }

  // ---- Case-team ----

  async listCaseTeam(user: RequestUser, caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    await this.access.caseTeamAccess(user, caseId);
    return this.page({ caseId, scope: "CASE_TEAM" }, query);
  }

  async sendCaseTeam(user: RequestUser, caseId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.access.caseTeamAccess(user, caseId);
    return this.create(caseId, "CASE_TEAM", user.id, dto.body);
  }

  // ---- Nonnis internal notes ----

  async listInternal(user: RequestUser, caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    await this.access.internalAccess(user, caseId);
    return this.page({ caseId, scope: "NONNIS_INTERNAL" }, query);
  }

  async sendInternal(user: RequestUser, caseId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.access.internalAccess(user, caseId);
    return this.create(caseId, "NONNIS_INTERNAL", user.id, dto.body);
  }

  // ---- Provider referral thread ----

  async listReferral(user: RequestUser, referralId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    const ref = await this.access.referralAccess(user, referralId);
    return this.page({ referralId, scope: "PROVIDER_REFERRAL", caseId: ref.caseId }, query);
  }

  async sendReferral(user: RequestUser, referralId: string, dto: SendMessageDto): Promise<MessageView> {
    const ref = await this.access.referralAccess(user, referralId);
    return this.create(ref.caseId, "PROVIDER_REFERRAL", user.id, dto.body, referralId);
  }
}
