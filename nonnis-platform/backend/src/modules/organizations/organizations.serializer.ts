import { Prisma } from "@prisma/client";
import type { OrganizationStatus, OrganizationType } from "@prisma/client";

export const organizationInclude = {
  _count: { select: { facilities: true, memberships: true } },
} satisfies Prisma.OrganizationInclude;

export type OrganizationRow = Prisma.OrganizationGetPayload<{ include: typeof organizationInclude }>;

export interface OrganizationView {
  id: string;
  type: OrganizationType;
  status: OrganizationStatus;
  name: string;
  legalName: string | null;
  externalRef: string | null;
  facilitiesCount: number;
  membersCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toOrganizationView(row: OrganizationRow): OrganizationView {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    legalName: row.legalName,
    externalRef: row.externalRef,
    facilitiesCount: row._count.facilities,
    membersCount: row._count.memberships,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
