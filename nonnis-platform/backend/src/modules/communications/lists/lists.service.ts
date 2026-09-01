import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { contactDetailInclude, toContactView, type ContactView } from "../communications.serializer";
import { SuppressionsService } from "../suppressions/suppressions.service";
import type { AddMembersDto, CreateListDto, ListMembersQueryDto, UpdateListDto } from "../dto/lists.dto";

export interface ListView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

function toListView(row: { id: string; name: string; description: string | null; active: boolean; createdAt: Date; updatedAt: Date; _count: { members: number } }): ListView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    memberCount: row._count.members,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly suppressions: SuppressionsService,
  ) {}

  async list(query: { page: number; pageSize: number; search?: string; activeOnly?: boolean }): Promise<PaginatedResult<ListView>> {
    const and: Prisma.CommunicationListWhereInput[] = [];
    if (query.activeOnly) and.push({ active: true });
    if (query.search) and.push({ name: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationListWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationList.findMany({ where, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationList.count({ where }),
    ]);
    return { items: rows.map(toListView), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  async options(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.communicationList.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  }

  async findOne(id: string): Promise<ListView> {
    const row = await this.prisma.communicationList.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!row) throw new NotFoundException("List not found");
    return toListView(row);
  }

  async create(user: RequestUser, dto: CreateListDto): Promise<ListView> {
    const created = await this.prisma.communicationList.create({
      data: { name: dto.name.trim(), description: dto.description?.trim() || null, createdByUserId: user.id, updatedByUserId: user.id },
      include: { _count: { select: { members: true } } },
    });
    await this.audit.record({ action: "communication.list.created", entityType: "CommunicationList", entityId: created.id, actorUserId: user.id, metadata: { name: created.name } });
    return toListView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateListDto): Promise<ListView> {
    const existing = await this.prisma.communicationList.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("List not found");
    const row = await this.prisma.communicationList.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        active: dto.active,
        updatedByUserId: user.id,
      },
      include: { _count: { select: { members: true } } },
    });
    await this.audit.record({ action: "communication.list.updated", entityType: "CommunicationList", entityId: id, actorUserId: user.id, metadata: { fields: Object.keys(dto) } });
    return toListView(row);
  }

  async members(id: string, query: ListMembersQueryDto): Promise<PaginatedResult<ContactView>> {
    await this.findOne(id);
    const contactWhere: Prisma.CommunicationContactWhereInput = query.search
      ? {
          OR: [
            { firstName: { contains: query.search.trim(), mode: "insensitive" } },
            { lastName: { contains: query.search.trim(), mode: "insensitive" } },
            { email: { contains: query.search.trim(), mode: "insensitive" } },
            { phone: { contains: query.search.trim(), mode: "insensitive" } },
          ],
        }
      : {};
    const where: Prisma.CommunicationListMemberWhereInput = { listId: id, contact: contactWhere };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationListMember.findMany({ where, include: { contact: { include: contactDetailInclude } }, orderBy: { addedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationListMember.count({ where }),
    ]);
    const contacts = rows.map((r) => r.contact);
    const flags = await this.suppressions.flagsFor(
      contacts.map((c) => c.normalizedEmail ?? "").filter(Boolean),
      contacts.map((c) => c.normalizedPhoneE164 ?? "").filter(Boolean),
    );
    return {
      items: contacts.map((c) => toContactView(c, { email: !!c.normalizedEmail && flags.emails.has(c.normalizedEmail), sms: !!c.normalizedPhoneE164 && flags.phones.has(c.normalizedPhoneE164) })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async addMembers(user: RequestUser, id: string, dto: AddMembersDto): Promise<{ added: number }> {
    await this.findOne(id);
    const result = await this.prisma.communicationListMember.createMany({
      data: dto.contactIds.map((contactId) => ({ listId: id, contactId, addedByUserId: user.id })),
      skipDuplicates: true,
    });
    await this.audit.record({ action: "communication.list.members_added", entityType: "CommunicationList", entityId: id, actorUserId: user.id, metadata: { added: result.count } });
    return { added: result.count };
  }

  async removeMember(user: RequestUser, id: string, contactId: string): Promise<{ removed: boolean }> {
    await this.prisma.communicationListMember.deleteMany({ where: { listId: id, contactId } });
    await this.audit.record({ action: "communication.list.member_removed", entityType: "CommunicationList", entityId: id, actorUserId: user.id, metadata: { contactId } });
    return { removed: true };
  }

  /** Find an active list by exact name or create it (used by import assignment). */
  async ensureByName(user: RequestUser, name: string): Promise<string> {
    const trimmed = name.trim();
    const existing = await this.prisma.communicationList.findFirst({ where: { name: trimmed, active: true }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.create(user, { name: trimmed });
    return created.id;
  }
}
