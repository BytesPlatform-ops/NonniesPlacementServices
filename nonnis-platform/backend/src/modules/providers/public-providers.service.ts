import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PublicProviderListDto } from "./dto/public-provider.dto";
import {
  providerPublicCardInclude,
  providerPublicDetailInclude,
  toProviderPublicCard,
  toProviderPublicDetail,
  type ProviderPublicCardView,
  type ProviderPublicDetailView,
} from "./public-provider.serializer";

export interface PublicDirectoryOptions {
  serviceCategories: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  paymentTypes: Array<{ id: string; name: string }>;
  states: string[];
}

/**
 * Public, unauthenticated residential-provider directory. Every query is hard
 * gated to ACTIVE + residential + published records; nothing else is ever
 * reachable through these methods, and only the explicit public serializer is
 * returned.
 */
@Injectable()
export class PublicProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  /** The single, non-negotiable public-eligibility filter. */
  private publishedWhere(): Prisma.ProviderWhereInput {
    return { status: "ACTIVE", isResidentialProvider: true, publicListingEnabled: true };
  }

  async list(query: PublicProviderListDto): Promise<PaginatedResult<ProviderPublicCardView>> {
    const and: Prisma.ProviderWhereInput[] = [this.publishedWhere()];
    if (query.q) {
      and.push({
        OR: [
          { displayName: { contains: query.q, mode: "insensitive" } },
          { city: { contains: query.q, mode: "insensitive" } },
          { publicDescription: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    if (query.state) and.push({ state: { contains: query.state, mode: "insensitive" } });
    if (query.city) and.push({ city: { contains: query.city, mode: "insensitive" } });
    if (query.serviceCategory) and.push({ services: { some: { serviceCategoryId: query.serviceCategory, active: true } } });
    if (query.language) and.push({ languages: { some: { languageId: query.language, active: true } } });
    if (query.paymentType) and.push({ paymentTypes: { some: { paymentTypeId: query.paymentType, active: true } } });

    const where: Prisma.ProviderWhereInput = { AND: and };
    const orderBy: Prisma.ProviderOrderByWithRelationInput[] =
      query.sort === "recent"
        ? [{ updatedAt: "desc" }]
        : query.sort === "name"
          ? [{ displayName: "asc" }]
          : [{ publicSortOrder: { sort: "asc", nulls: "last" } }, { displayName: "asc" }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.provider.findMany({
        where,
        include: providerPublicCardInclude,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      items: rows.map(toProviderPublicCard),
      page: query.page,
      pageSize: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async findBySlug(slug: string): Promise<ProviderPublicDetailView> {
    const row = await this.prisma.provider.findFirst({
      where: { AND: [this.publishedWhere(), { publicSlug: slug }] },
      include: providerPublicDetailInclude,
    });
    if (!row) throw new NotFoundException("Residential provider not found");
    return toProviderPublicDetail(row);
  }

  /** Filter options limited to values that actually occur among published providers. */
  async options(): Promise<PublicDirectoryOptions> {
    const providers = await this.prisma.provider.findMany({
      where: this.publishedWhere(),
      select: {
        state: true,
        services: { where: { active: true }, select: { serviceCategory: { select: { id: true, name: true } } } },
        languages: { where: { active: true }, select: { language: { select: { id: true, name: true } } } },
        paymentTypes: { where: { active: true }, select: { paymentType: { select: { id: true, name: true } } } },
      },
    });

    const categories = new Map<string, string>();
    const languages = new Map<string, string>();
    const paymentTypes = new Map<string, string>();
    const states = new Set<string>();
    for (const p of providers) {
      if (p.state && p.state.trim()) states.add(p.state.trim());
      for (const s of p.services) categories.set(s.serviceCategory.id, s.serviceCategory.name);
      for (const l of p.languages) languages.set(l.language.id, l.language.name);
      for (const pt of p.paymentTypes) paymentTypes.set(pt.paymentType.id, pt.paymentType.name);
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return {
      serviceCategories: [...categories].map(([id, name]) => ({ id, name })).sort(byName),
      languages: [...languages].map(([id, name]) => ({ id, name })).sort(byName),
      paymentTypes: [...paymentTypes].map(([id, name]) => ({ id, name })).sort(byName),
      states: [...states].sort((a, b) => a.localeCompare(b)),
    };
  }
}
