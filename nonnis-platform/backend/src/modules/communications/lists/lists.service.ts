import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { contactDetailInclude, toContactView, type ContactView } from "../communications.serializer";
import { SuppressionsService } from "../suppressions/suppressions.service";
import type { AddMembersDto, CreateListDto, DuplicateListDto, ListMembersQueryDto, UpdateListDto } from "../dto/lists.dto";
import { SYSTEM_AUDIENCES, isSystemAudienceKey, systemAudience } from "./system-audiences";

export interface ListView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  memberCount: number;
  /**
   * Set when this is a DERIVED audience whose membership follows a rule rather
   * than rows someone added. The UI uses it to stop offering Add/Remove, which
   * this service also refuses server-side.
   */
  systemKey: string | null;
  createdAt: string;
  updatedAt: string;
}

function toListView(
  row: { id: string; name: string; description: string | null; active: boolean; systemKey: string | null; createdAt: Date; updatedAt: Date; _count: { members: number } },
  /** Live count for a derived audience, whose `members` rows are always empty. */
  derivedCount?: number,
): ListView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    memberCount: derivedCount ?? row._count.members,
    systemKey: row.systemKey,
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
    await this.ensureSystemAudiences();
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationList.findMany({ where, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationList.count({ where }),
    ]);
    const counts = await this.derivedCounts(rows);
    return {
      items: rows.map((r) => toListView(r, counts.get(r.id))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  /**
   * Create any derived audience that does not exist yet.
   *
   * Done on read rather than in a migration so the definitions in code stay the
   * single source of truth: adding one needs no schema change and no data
   * migration. Idempotent and concurrency-safe — the unique `systemKey` settles
   * a race, and a loser simply finds the winner's row.
   */
  private async ensureSystemAudiences(): Promise<void> {
    for (const definition of Object.values(SYSTEM_AUDIENCES)) {
      try {
        await this.prisma.communicationList.upsert({
          where: { systemKey: definition.key },
          // Name and description are refreshed from code; an operator renaming a
          // derived audience in the database would otherwise drift from it.
          update: { name: definition.name, description: definition.description },
          create: { systemKey: definition.key, name: definition.name, description: definition.description },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      }
    }
  }

  /** Live membership counts for the derived audiences among `rows`. */
  private async derivedCounts(rows: Array<{ id: string; systemKey: string | null }>): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const definition = systemAudience(row.systemKey);
      if (!definition) continue;
      counts.set(row.id, await this.prisma.communicationContact.count({ where: definition.where }));
    }
    return counts;
  }

  async options(): Promise<Array<{ id: string; name: string }>> {
    await this.ensureSystemAudiences();
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
    const list = await this.findOne(id);
    const derived = systemAudience(list.systemKey);
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
    // A derived audience has no membership rows to read, so page the contacts
    // that satisfy its predicate instead. Same shape out, so the members view
    // does not have to know which kind of list it is looking at.
    let contacts, total: number;
    if (derived) {
      const where: Prisma.CommunicationContactWhereInput = { AND: [derived.where, contactWhere] };
      const [rows, count] = await this.prisma.$transaction([
        this.prisma.communicationContact.findMany({ where, include: contactDetailInclude, orderBy: [{ lastName: "asc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        this.prisma.communicationContact.count({ where }),
      ]);
      contacts = rows;
      total = count;
    } else {
      const where: Prisma.CommunicationListMemberWhereInput = { listId: id, contact: contactWhere };
      const [rows, count] = await this.prisma.$transaction([
        this.prisma.communicationListMember.findMany({ where, include: { contact: { include: contactDetailInclude } }, orderBy: { addedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        this.prisma.communicationListMember.count({ where }),
      ]);
      contacts = rows.map((r) => r.contact);
      total = count;
    }
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

  /**
   * Copy a list's members into a new, ordinary list.
   *
   * The point is to be able to tailor an audience for one campaign without
   * touching the list other campaigns rely on. So this always produces a
   * CURATED list, even when copying a derived audience: the copy is a snapshot
   * taken now and editable by hand, which is exactly what "just for this send"
   * means. The source is never modified.
   *
   * A derived audience has no membership rows, so its members come from running
   * its predicate — the same resolution the campaign itself would perform.
   */
  async duplicate(user: RequestUser, id: string, dto: DuplicateListDto): Promise<ListView> {
    const source = await this.findOne(id);
    const derived = systemAudience(source.systemKey);

    const contactIds = derived
      ? (await this.prisma.communicationContact.findMany({ where: derived.where, select: { id: true } })).map((c) => c.id)
      : (await this.prisma.communicationListMember.findMany({ where: { listId: id }, select: { contactId: true } })).map((m) => m.contactId);

    const name = dto.name?.trim() || `${source.name} (copy)`;
    const created = await this.prisma.$transaction(async (tx) => {
      const list = await tx.communicationList.create({
        data: {
          name,
          description: `Copied from "${source.name}". Editing this list does not affect the original.`,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: { _count: { select: { members: true } } },
      });
      if (contactIds.length) {
        await tx.communicationListMember.createMany({
          data: contactIds.map((contactId) => ({ listId: list.id, contactId, addedByUserId: user.id })),
          skipDuplicates: true,
        });
      }
      return list;
    });

    await this.audit.record({
      action: "communication.list.duplicated",
      entityType: "CommunicationList",
      entityId: created.id,
      actorUserId: user.id,
      metadata: { sourceListId: id, sourceSystemKey: source.systemKey, copied: contactIds.length },
    });

    // The count comes from what was just inserted; the row was read before them.
    return { ...toListView(created), memberCount: contactIds.length };
  }

  async addMembers(user: RequestUser, id: string, dto: AddMembersDto): Promise<{ added: number }> {
    await this.assertCurated(id);
    const result = await this.prisma.communicationListMember.createMany({
      data: dto.contactIds.map((contactId) => ({ listId: id, contactId, addedByUserId: user.id })),
      skipDuplicates: true,
    });
    await this.audit.record({ action: "communication.list.members_added", entityType: "CommunicationList", entityId: id, actorUserId: user.id, metadata: { added: result.count } });
    return { added: result.count };
  }

  async removeMember(user: RequestUser, id: string, contactId: string): Promise<{ removed: boolean }> {
    await this.assertCurated(id);
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

  /**
   * Refuse hand-editing a derived audience.
   *
   * Server-side, not merely hidden in the UI: an added row would be ignored by
   * resolution and would then look like a member who never receives anything.
   */
  private async assertCurated(id: string): Promise<void> {
    const list = await this.findOne(id);
    if (isSystemAudienceKey(list.systemKey)) {
      throw new BadRequestException(`"${list.name}" follows SMS consent automatically — members cannot be added or removed by hand.`);
    }
  }
}
