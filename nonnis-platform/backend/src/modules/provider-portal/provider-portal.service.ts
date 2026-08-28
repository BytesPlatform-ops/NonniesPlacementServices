import { Injectable } from "@nestjs/common";
import type { CapacityStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../auth/request-user";
import { ProvidersService } from "../providers/providers.service";
import type { ProviderDetailView } from "../providers/providers.serializer";
import { computeProviderCompleteness, type ProviderCompleteness } from "./provider-completeness";

export interface ProviderPortalSummary {
  servicesCount: number;
  coverageCount: number;
  paymentTypesCount: number;
  languagesCount: number;
  availability: CapacityStatus;
  lastCapacityUpdate: string | null;
}

export interface ProviderPortalMe {
  hasProvider: boolean;
  organizationId: string | null;
  provider: ProviderDetailView | null;
  completeness: ProviderCompleteness | null;
  summary: ProviderPortalSummary | null;
}

/**
 * Resolves the provider belonging to the caller's ACTIVE organization and
 * returns a portal dashboard payload. Provider identity is derived from the
 * authenticated membership — never from a browser-supplied id. Detail loading
 * delegates to ProvidersService, so ProviderAccessService isolation and the
 * internal-notes exclusion still apply.
 */
@Injectable()
export class ProviderPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProvidersService,
  ) {}

  private empty(organizationId: string | null): ProviderPortalMe {
    return { hasProvider: false, organizationId, provider: null, completeness: null, summary: null };
  }

  async me(user: RequestUser): Promise<ProviderPortalMe> {
    const organizationId = user.activeOrganizationId;
    if (!organizationId) return this.empty(null);

    const found = await this.prisma.provider.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    if (!found) return this.empty(organizationId);

    // Secure detail load (enforces access + strips internal notes for provider users).
    const provider = await this.providers.findOne(user, found.id);

    const activeServices = provider.services.filter((s) => s.active).length;
    const activeCoverage = provider.coverageAreas.filter((c) => c.active).length;
    const activePaymentTypes = provider.paymentTypes.filter((p) => p.active).length;
    const activeLanguages = provider.languages.filter((l) => l.active).length;

    const completeness = computeProviderCompleteness({
      phone: provider.phone,
      email: provider.email,
      city: provider.city,
      state: provider.state,
      activeServices,
      activeCoverage,
      activePaymentTypes,
      activeLanguages,
      hoursConfigured: provider.hours.length,
      capacityConfigured: provider.capacity.length,
    });

    const overall = provider.capacity.find((c) => c.serviceCategoryId === null);
    const availability: CapacityStatus = (overall?.status ?? provider.capacity[0]?.status ?? "UNKNOWN") as CapacityStatus;
    const lastCapacityUpdate = provider.capacity.reduce<string | null>(
      (latest, c) => (latest === null || c.updatedAt > latest ? c.updatedAt : latest),
      null,
    );

    const summary: ProviderPortalSummary = {
      servicesCount: activeServices,
      coverageCount: activeCoverage,
      paymentTypesCount: activePaymentTypes,
      languagesCount: activeLanguages,
      availability,
      lastCapacityUpdate,
    };

    return { hasProvider: true, organizationId, provider, completeness, summary };
  }
}
