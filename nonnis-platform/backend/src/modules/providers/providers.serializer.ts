import { Prisma, type CapacityStatus, type CoverageType, type DayOfWeek, type LevelOfCare, type ProviderStatus } from "@prisma/client";

// ---- Includes ----

export const providerListInclude = {
  organization: { select: { id: true, name: true, status: true } },
  _count: { select: { services: true, coverageAreas: true, languages: true, paymentTypes: true } },
  capacity: { select: { status: true, serviceCategoryId: true } },
} satisfies Prisma.ProviderInclude;

export type ProviderListRow = Prisma.ProviderGetPayload<{ include: typeof providerListInclude }>;

export const providerDetailInclude = {
  organization: { select: { id: true, name: true, type: true, status: true } },
  services: {
    include: { serviceCategory: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  coverageAreas: { orderBy: { createdAt: "asc" } },
  paymentTypes: {
    include: { paymentType: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  languages: {
    include: { language: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  hours: { orderBy: { dayOfWeek: "asc" } },
  capacity: {
    include: {
      serviceCategory: { select: { id: true, code: true, name: true } },
      updatedBy: { select: { id: true, displayName: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.ProviderInclude;

export type ProviderDetailRow = Prisma.ProviderGetPayload<{ include: typeof providerDetailInclude }>;

// ---- Views ----

export interface ProviderSummaryView {
  id: string;
  organizationId: string;
  organizationName: string;
  displayName: string;
  status: ProviderStatus;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  servicesCount: number;
  coverageAreasCount: number;
  languagesCount: number;
  paymentTypesCount: number;
  availabilityStatus: CapacityStatus;
  editable: boolean;
  updatedAt: string;
}

export interface ProviderServiceView {
  id: string;
  serviceCategoryId: string;
  categoryCode: string;
  categoryName: string;
  active: boolean;
  description: string | null;
  levelOfCare: LevelOfCare | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageAreaView {
  id: string;
  coverageType: CoverageType;
  city: string | null;
  county: string | null;
  state: string | null;
  postalCode: string | null;
  radiusMiles: number | null;
  notes: string | null;
  active: boolean;
}

export interface ProviderPaymentTypeView {
  id: string;
  paymentTypeId: string;
  code: string;
  name: string;
  active: boolean;
  notes: string | null;
}

export interface ProviderLanguageView {
  id: string;
  languageId: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ProviderHoursView {
  id: string;
  dayOfWeek: DayOfWeek;
  closed: boolean;
  open24: boolean;
  opensAt: string | null;
  closesAt: string | null;
  notes: string | null;
}

export interface ProviderCapacityView {
  id: string;
  serviceCategoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  status: CapacityStatus;
  availableCount: number | null;
  effectiveDate: string | null;
  notes: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface ProviderDetailView {
  id: string;
  organizationId: string;
  organization: { id: string; name: string; type: string; status: string };
  status: ProviderStatus;
  displayName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  eligibilityNotes: string | null;
  /** Internal notes only present for users who can manage this provider. */
  internalNotes: string | null;
  licenseNumber: string | null;
  licenseType: string | null;
  services: ProviderServiceView[];
  coverageAreas: CoverageAreaView[];
  paymentTypes: ProviderPaymentTypeView[];
  languages: ProviderLanguageView[];
  hours: ProviderHoursView[];
  capacity: ProviderCapacityView[];
  editable: boolean;
  canManageCapacity: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Helpers ----

/** Overall availability = the provider-level (uncategorized) capacity row, else UNKNOWN. */
function overallAvailability(rows: Array<{ status: CapacityStatus; serviceCategoryId: string | null }>): CapacityStatus {
  const providerLevel = rows.find((r) => r.serviceCategoryId === null);
  if (providerLevel) return providerLevel.status;
  return rows[0]?.status ?? "UNKNOWN";
}

export function toProviderSummaryView(row: ProviderListRow, editable: boolean): ProviderSummaryView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    displayName: row.displayName,
    status: row.status,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    servicesCount: row._count.services,
    coverageAreasCount: row._count.coverageAreas,
    languagesCount: row._count.languages,
    paymentTypesCount: row._count.paymentTypes,
    availabilityStatus: overallAvailability(row.capacity),
    editable,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function personName(u: { displayName: string | null; firstName: string | null; lastName: string | null; email: string } | null): string | null {
  if (!u) return null;
  return u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

export function toProviderServiceView(row: ProviderDetailRow["services"][number]): ProviderServiceView {
  return {
    id: row.id,
    serviceCategoryId: row.serviceCategoryId,
    categoryCode: row.serviceCategory.code,
    categoryName: row.serviceCategory.name,
    active: row.active,
    description: row.description,
    levelOfCare: row.levelOfCare,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCoverageAreaView(row: ProviderDetailRow["coverageAreas"][number]): CoverageAreaView {
  return {
    id: row.id,
    coverageType: row.coverageType,
    city: row.city,
    county: row.county,
    state: row.state,
    postalCode: row.postalCode,
    radiusMiles: row.radiusMiles,
    notes: row.notes,
    active: row.active,
  };
}

export function toProviderPaymentTypeView(row: ProviderDetailRow["paymentTypes"][number]): ProviderPaymentTypeView {
  return {
    id: row.id,
    paymentTypeId: row.paymentTypeId,
    code: row.paymentType.code,
    name: row.paymentType.name,
    active: row.active,
    notes: row.notes,
  };
}

export function toProviderLanguageView(row: ProviderDetailRow["languages"][number]): ProviderLanguageView {
  return {
    id: row.id,
    languageId: row.languageId,
    code: row.language.code,
    name: row.language.name,
    active: row.active,
  };
}

export function toProviderHoursView(row: ProviderDetailRow["hours"][number]): ProviderHoursView {
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    closed: row.closed,
    open24: row.open24,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    notes: row.notes,
  };
}

export function toProviderCapacityView(row: ProviderDetailRow["capacity"][number]): ProviderCapacityView {
  return {
    id: row.id,
    serviceCategoryId: row.serviceCategoryId,
    categoryCode: row.serviceCategory?.code ?? null,
    categoryName: row.serviceCategory?.name ?? null,
    status: row.status,
    availableCount: row.availableCount,
    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : null,
    notes: row.notes,
    updatedByName: personName(row.updatedBy),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProviderDetailView(
  row: ProviderDetailRow,
  opts: { editable: boolean; canManageCapacity: boolean },
): ProviderDetailView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      type: row.organization.type,
      status: row.organization.status,
    },
    status: row.status,
    displayName: row.displayName,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    timezone: row.timezone,
    eligibilityNotes: row.eligibilityNotes,
    internalNotes: opts.editable ? row.internalNotes : null,
    licenseNumber: row.licenseNumber,
    licenseType: row.licenseType,
    services: row.services.map(toProviderServiceView),
    coverageAreas: row.coverageAreas.map(toCoverageAreaView),
    paymentTypes: row.paymentTypes.map(toProviderPaymentTypeView),
    languages: row.languages.map(toProviderLanguageView),
    hours: row.hours.map(toProviderHoursView),
    capacity: row.capacity.map(toProviderCapacityView),
    editable: opts.editable,
    canManageCapacity: opts.canManageCapacity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
