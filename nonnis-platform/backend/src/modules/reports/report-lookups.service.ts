import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

/**
 * Batch name resolution for reporting. Several columns are raw UUID scalars with
 * no Prisma relation (task assignees, form-submission reviewers, grouped
 * org/facility keys); resolving them one query per unique id set keeps report
 * rows free of N+1 lookups and free of bare UUIDs.
 */
@Injectable()
export class ReportLookupService {
  constructor(private readonly prisma: PrismaService) {}

  private clean(ids: Array<string | null | undefined>): string[] {
    return [...new Set(ids.filter((id): id is string => Boolean(id)))];
  }

  async userNames(ids: Array<string | null | undefined>): Promise<Map<string, string | null>> {
    const unique = this.clean(ids);
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    });
    return new Map(
      users.map((u) => [
        u.id,
        u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || null),
      ]),
    );
  }

  async organizationNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = this.clean(ids);
    if (unique.length === 0) return new Map();
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(orgs.map((o) => [o.id, o.name]));
  }

  async facilityNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = this.clean(ids);
    if (unique.length === 0) return new Map();
    const facilities = await this.prisma.facility.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(facilities.map((f) => [f.id, f.name]));
  }

  async providerNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = this.clean(ids);
    if (unique.length === 0) return new Map();
    const providers = await this.prisma.provider.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(providers.map((p) => [p.id, p.displayName]));
  }
}
