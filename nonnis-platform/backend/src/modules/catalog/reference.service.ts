import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { toReferenceItemView, type ReferenceItemView } from "./catalog.serializer";
import type {
  CatalogStatusDto,
  CreateReferenceItemDto,
  ListCatalogQueryDto,
  UpdateReferenceItemDto,
} from "./dto/catalog.dto";

type ReferenceKind = "paymentType" | "language";

interface ReferenceRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal structural view over the two identically-shaped Prisma delegates. */
interface ReferenceDelegate {
  findMany(args: {
    where?: unknown;
    orderBy?: unknown;
    skip?: number;
    take?: number;
  }): Promise<ReferenceRow[]>;
  count(args: { where?: unknown }): Promise<number>;
  findUnique(args: { where: unknown; select?: unknown }): Promise<{ id: string } | null>;
  create(args: { data: { code: string; name: string; sortOrder: number } }): Promise<ReferenceRow>;
  update(args: { where: { id: string }; data: unknown }): Promise<ReferenceRow>;
}

/**
 * Admin-managed reference catalogs (payment/insurance types and languages).
 * Both share an identical shape (code/name/active/sortOrder), so one service
 * drives both delegates. Soft deactivation only — never hard-deleted.
 */
@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private delegate(kind: ReferenceKind): ReferenceDelegate {
    const d = kind === "paymentType" ? this.prisma.paymentType : this.prisma.language;
    return d as unknown as ReferenceDelegate;
  }

  private entityType(kind: ReferenceKind): string {
    return kind === "paymentType" ? "PaymentType" : "Language";
  }

  private auditAction(kind: ReferenceKind, verb: string): string {
    return `${kind === "paymentType" ? "payment_type" : "language"}.${verb}`;
  }

  async list(kind: ReferenceKind, query: ListCatalogQueryDto): Promise<PaginatedResult<ReferenceItemView>> {
    const { page, pageSize, q, activeOnly } = query;
    const where = {
      ...(activeOnly ? { active: true } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }
        : {}),
    };
    const delegate = this.delegate(kind);
    const rows = await delegate.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await delegate.count({ where });
    return {
      items: rows.map(toReferenceItemView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async create(kind: ReferenceKind, user: RequestUser, dto: CreateReferenceItemDto): Promise<ReferenceItemView> {
    const delegate = this.delegate(kind);
    const existing = await delegate.findUnique({ where: { code: dto.code }, select: { id: true } });
    if (existing) throw new ConflictException(`A ${label(kind)} with code ${dto.code} already exists`);
    const created = await delegate.create({
      data: { code: dto.code, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.audit.record({
      action: this.auditAction(kind, "created"),
      entityType: this.entityType(kind),
      entityId: created.id,
      actorUserId: user.id,
      metadata: { code: created.code, name: created.name },
    });
    return toReferenceItemView(created);
  }

  async update(
    kind: ReferenceKind,
    user: RequestUser,
    id: string,
    dto: UpdateReferenceItemDto,
  ): Promise<ReferenceItemView> {
    await this.ensureExists(kind, id);
    const updated = await this.delegate(kind).update({ where: { id }, data: { name: dto.name, sortOrder: dto.sortOrder } });
    await this.audit.record({
      action: this.auditAction(kind, "updated"),
      entityType: this.entityType(kind),
      entityId: id,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toReferenceItemView(updated);
  }

  async setStatus(
    kind: ReferenceKind,
    user: RequestUser,
    id: string,
    dto: CatalogStatusDto,
  ): Promise<ReferenceItemView> {
    await this.ensureExists(kind, id);
    const updated = await this.delegate(kind).update({ where: { id }, data: { active: dto.active } });
    await this.audit.record({
      action: this.auditAction(kind, "status_changed"),
      entityType: this.entityType(kind),
      entityId: id,
      actorUserId: user.id,
      metadata: { active: dto.active },
    });
    return toReferenceItemView(updated);
  }

  private async ensureExists(kind: ReferenceKind, id: string): Promise<void> {
    const found = await this.delegate(kind).findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`${label(kind)} ${id} not found`);
  }
}

function label(kind: ReferenceKind): string {
  return kind === "paymentType" ? "payment type" : "language";
}
