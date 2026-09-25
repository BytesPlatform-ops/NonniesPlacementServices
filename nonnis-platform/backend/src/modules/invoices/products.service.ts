import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ProductCategory } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";

export interface ProductView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  active: boolean;
  recurring: boolean;
  /** A starting figure only. Null while a price is undecided. */
  suggestedUnitPrice: string | null;
  currency: string;
  updatedAt: string;
}

/**
 * The two things Nonni's bills for, as seeded on first read.
 *
 * Seeded from code rather than a data migration so the catalogue stays
 * self-describing and adding one needs no schema work. Names and descriptions
 * are refreshed from here; PRICES never are — a price belongs to an invoice.
 */
export const SEED_PRODUCTS: Array<{ code: string; name: string; description: string; category: ProductCategory; recurring: boolean }> = [
  {
    code: "PROVIDER_SUBSCRIPTION",
    name: "Nonni's Provider Subscription",
    description:
      "Monthly access to Nonni's provider platform, including the facility profile, bed availability, and referral tools.",
    category: "PLATFORM_SUBSCRIPTION",
    recurring: true,
  },
  {
    code: "PRIVATE_PAY_PLACEMENT_FEE",
    name: "Nonni's Private-Pay Placement Fee",
    description:
      "One-time fee charged to the provider after a successful private-pay placement, according to the signed provider agreement.",
    category: "PLACEMENT_SERVICE",
    recurring: false,
  },
];

function toProductView(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  active: boolean;
  recurring: boolean;
  suggestedUnitPrice: Prisma.Decimal | null;
  currency: string;
  updatedAt: Date;
}): ProductView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    active: row.active,
    recurring: row.recurring,
    suggestedUnitPrice: row.suggestedUnitPrice ? row.suggestedUnitPrice.toFixed(2) : null,
    currency: row.currency,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * What Nonni's bills for — and deliberately not what it costs.
 *
 * A product names a KIND of charge. The placement fee is whatever the signed
 * agreement says for that placement; the subscription price is not settled yet.
 * A number here would become a second source of truth that an invoice would
 * eventually disagree with, so the only price a product may carry is an openly
 * labelled SUGGESTION an admin can start from and must then approve.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Make sure the catalogue exists.
   *
   * Idempotent and concurrency-safe: the unique `code` settles a race, and a
   * loser finds the winner's row. Prices are never touched here.
   */
  private async ensureSeeded(): Promise<void> {
    for (const seed of SEED_PRODUCTS) {
      try {
        await this.prisma.product.upsert({
          where: { code: seed.code },
          update: { name: seed.name, description: seed.description, category: seed.category, recurring: seed.recurring },
          create: seed,
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      }
    }
  }

  async list(activeOnly = false): Promise<ProductView[]> {
    await this.ensureSeeded();
    const rows = await this.prisma.product.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return rows.map(toProductView);
  }

  /**
   * Set the suggested starting price, or clear it.
   *
   * This is the "configure the monthly price from the admin panel without a
   * deployment" control. It changes what an admin is OFFERED when writing a new
   * invoice; it changes no existing invoice, and it still has to be approved
   * before it reaches a provider.
   */
  async updatePricing(
    user: RequestUser,
    id: string,
    dto: { suggestedUnitPrice?: string | null; currency?: string; active?: boolean },
  ): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true, code: true } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    let suggested: Prisma.Decimal | null | undefined;
    if (dto.suggestedUnitPrice !== undefined) {
      if (dto.suggestedUnitPrice === null || dto.suggestedUnitPrice === "") {
        suggested = null;
      } else {
        suggested = new Prisma.Decimal(dto.suggestedUnitPrice);
        if (suggested.isNegative()) throw new BadRequestException("A price cannot be negative.");
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(suggested !== undefined ? { suggestedUnitPrice: suggested } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        updatedByUserId: user.id,
      },
    });

    await this.audit.record({
      action: "product.pricing_updated",
      entityType: "Product",
      entityId: id,
      actorUserId: user.id,
      metadata: {
        code: existing.code,
        suggestedUnitPrice: updated.suggestedUnitPrice ? updated.suggestedUnitPrice.toFixed(2) : null,
        active: updated.active,
      },
    });
    return toProductView(updated);
  }
}
