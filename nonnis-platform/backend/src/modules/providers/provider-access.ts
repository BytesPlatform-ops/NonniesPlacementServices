import { Injectable, NotFoundException } from "@nestjs/common";
import type { ProviderStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

export interface ProviderRef {
  id: string;
  organizationId: string;
  status: ProviderStatus;
}

function memberOrgIds(user: RequestUser): string[] {
  return user.memberships.map((m) => m.organizationId);
}

/** Nonnis staff who manage every provider. */
export function canManageAllProviders(user: RequestUser): boolean {
  return user.activePermissions.has(PERMISSIONS.PROVIDERS_MANAGE);
}

/** Provider users who manage only their own organization's provider. */
export function canManageOwnProviders(user: RequestUser): boolean {
  return user.activePermissions.has(PERMISSIONS.PROVIDERS_MANAGE_OWN);
}

/** Directory-only readers (e.g. discharge professionals): read all, manage none. */
function isDirectoryOnlyReader(user: RequestUser): boolean {
  return !canManageAllProviders(user) && !canManageOwnProviders(user);
}

/** Whether the user may see the full (internal) view of a specific provider. */
export function canManageProvider(user: RequestUser, provider: ProviderRef): boolean {
  if (canManageAllProviders(user)) return true;
  return canManageOwnProviders(user) && memberOrgIds(user).includes(provider.organizationId);
}

/**
 * Central provider access control. Nonnis staff act across all providers;
 * provider users are strictly bounded to their own organization's provider.
 * Cross-provider access returns 404 to avoid revealing that a provider exists.
 */
@Injectable()
export class ProviderAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prisma `where` fragment scoping a provider list to what the user may read. */
  listScope(user: RequestUser): { organizationId?: { in: string[] } } {
    if (canManageAllProviders(user) || isDirectoryOnlyReader(user)) return {};
    // Provider-scoped user: only their own organization's provider.
    return { organizationId: { in: memberOrgIds(user) } };
  }

  private async load(providerId: string): Promise<ProviderRef> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!provider) throw new NotFoundException(`Provider ${providerId} not found`);
    return provider;
  }

  /** Load a provider the user is allowed to read, or 404. */
  async loadForRead(user: RequestUser, providerId: string): Promise<ProviderRef> {
    const provider = await this.load(providerId);
    if (canManageAllProviders(user) || isDirectoryOnlyReader(user)) return provider;
    if (canManageOwnProviders(user) && memberOrgIds(user).includes(provider.organizationId)) return provider;
    throw new NotFoundException(`Provider ${providerId} not found`);
  }

  /** Load a provider the user is allowed to modify, or 404. */
  async loadForWrite(user: RequestUser, providerId: string): Promise<ProviderRef> {
    const provider = await this.load(providerId);
    if (canManageProvider(user, provider)) return provider;
    throw new NotFoundException(`Provider ${providerId} not found`);
  }

  /** Load a provider whose capacity the user may update, or 404. */
  async loadForCapacityWrite(user: RequestUser, providerId: string): Promise<ProviderRef> {
    const provider = await this.load(providerId);
    const all = user.activePermissions.has(PERMISSIONS.PROVIDER_CAPACITY_MANAGE);
    const own =
      user.activePermissions.has(PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN) &&
      memberOrgIds(user).includes(provider.organizationId);
    if (all || own) return provider;
    throw new NotFoundException(`Provider ${providerId} not found`);
  }
}
