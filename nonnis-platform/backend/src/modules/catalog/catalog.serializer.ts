import { Prisma } from "@prisma/client";

export const serviceCategoryInclude = {
  _count: { select: { providerServices: true } },
} satisfies Prisma.ServiceCategoryInclude;

export type ServiceCategoryRow = Prisma.ServiceCategoryGetPayload<{ include: typeof serviceCategoryInclude }>;

export interface ServiceCategoryView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  providerServicesCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toServiceCategoryView(row: ServiceCategoryRow): ServiceCategoryView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    sortOrder: row.sortOrder,
    providerServicesCount: row._count.providerServices,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ReferenceItemView {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toReferenceItemView(row: {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ReferenceItemView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
