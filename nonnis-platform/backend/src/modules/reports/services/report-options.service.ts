import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";

export interface ReportFilterOptions {
  organizations: Array<{ id: string; name: string }>;
  facilities: Array<{ id: string; name: string; organizationId: string }>;
  serviceCategories: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  paymentTypes: Array<{ id: string; name: string }>;
}

/**
 * Cross-organization option lists that populate the report filter controls.
 * Reports are Nonnis platform-wide, so these are intentionally unscoped; access
 * is still gated by `reports.read` on the controller.
 */
@Injectable()
export class ReportOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async options(): Promise<ReportFilterOptions> {
    const [organizations, facilities, serviceCategories, languages, paymentTypes] = await Promise.all([
      this.prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, organizationId: true } }),
      this.prisma.serviceCategory.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.prisma.language.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.prisma.paymentType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return { organizations, facilities, serviceCategories, languages, paymentTypes };
  }
}
