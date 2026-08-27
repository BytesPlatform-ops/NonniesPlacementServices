import { Prisma, type FacilityStatus } from "@prisma/client";

export const facilityInclude = {
  _count: { select: { cases: true } },
} satisfies Prisma.FacilityInclude;

export type FacilityRow = Prisma.FacilityGetPayload<{ include: typeof facilityInclude }>;

export interface FacilityView {
  id: string;
  organizationId: string;
  status: FacilityStatus;
  name: string;
  externalRef: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  casesCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toFacilityView(row: FacilityRow): FacilityView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    name: row.name,
    externalRef: row.externalRef,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
    casesCount: row._count.cases,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
