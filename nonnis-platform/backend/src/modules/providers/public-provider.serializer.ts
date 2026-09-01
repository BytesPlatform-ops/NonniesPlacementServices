import { Prisma, type CoverageType, type DayOfWeek } from "@prisma/client";

/**
 * PUBLIC provider serializer — the explicit, minimum-necessary projection for the
 * public residential directory. It NEVER includes internal notes, eligibility
 * notes, capacity, provider users/memberships, organization/user ids, audit data,
 * timestamps, status, or storage paths. Canonical provider fields (displayName,
 * description, phone, email, website, city, state) are the public source; a
 * public description/image override them when set.
 */

export const providerPublicCardInclude = {
  services: { where: { active: true }, select: { serviceCategory: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
  languages: { where: { active: true }, select: { language: { select: { name: true } } } },
} satisfies Prisma.ProviderInclude;

export type ProviderPublicCardRow = Prisma.ProviderGetPayload<{ include: typeof providerPublicCardInclude }>;

export const providerPublicDetailInclude = {
  services: {
    where: { active: true },
    select: { serviceCategory: { select: { name: true } }, description: true, levelOfCare: true },
    orderBy: { createdAt: "asc" },
  },
  languages: { where: { active: true }, select: { language: { select: { name: true } } } },
  paymentTypes: { where: { active: true }, select: { paymentType: { select: { name: true } } } },
  coverageAreas: { where: { active: true }, orderBy: { createdAt: "asc" } },
  hours: { orderBy: { dayOfWeek: "asc" } },
} satisfies Prisma.ProviderInclude;

export type ProviderPublicDetailRow = Prisma.ProviderGetPayload<{ include: typeof providerPublicDetailInclude }>;

export interface ProviderPublicCardView {
  slug: string;
  name: string;
  summary: string | null;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  services: string[];
  languages: string[];
}

export interface ProviderPublicDetailView {
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  imageUrl: string | null;
  services: Array<{ name: string; levelOfCare: string | null; description: string | null }>;
  coverage: string[];
  paymentTypes: string[];
  languages: string[];
  hours: Array<{ day: DayOfWeek; closed: boolean; open24: boolean; opensAt: string | null; closesAt: string | null }>;
}

function coverageLabel(area: { coverageType: CoverageType; city: string | null; county: string | null; state: string | null; postalCode: string | null; radiusMiles: number | null }): string {
  switch (area.coverageType) {
    case "CITY":
      return [area.city, area.state].filter(Boolean).join(", ");
    case "COUNTY":
      return [area.county ? `${area.county} County` : null, area.state].filter(Boolean).join(", ");
    case "STATE":
      return area.state ?? "";
    case "POSTAL_CODE":
      return area.postalCode ?? "";
    case "RADIUS":
      return area.radiusMiles ? `Within ${area.radiusMiles} mi of ${[area.city, area.state].filter(Boolean).join(", ")}` : "";
    default:
      return "";
  }
}

export function toProviderPublicCard(row: ProviderPublicCardRow): ProviderPublicCardView {
  return {
    slug: row.publicSlug ?? "",
    name: row.displayName,
    summary: row.publicDescription ?? row.description ?? null,
    city: row.city,
    state: row.state,
    imageUrl: row.publicFeaturedImageUrl ?? null,
    services: [...new Set(row.services.map((s) => s.serviceCategory.name))],
    languages: [...new Set(row.languages.map((l) => l.language.name))],
  };
}

export function toProviderPublicDetail(row: ProviderPublicDetailRow): ProviderPublicDetailView {
  return {
    slug: row.publicSlug ?? "",
    name: row.displayName,
    description: row.publicDescription ?? row.description ?? null,
    city: row.city,
    state: row.state,
    addressLine1: row.addressLine1,
    postalCode: row.postalCode,
    phone: row.phone,
    email: row.email,
    website: row.website,
    imageUrl: row.publicFeaturedImageUrl ?? null,
    services: row.services.map((s) => ({ name: s.serviceCategory.name, levelOfCare: s.levelOfCare, description: s.description })),
    coverage: [...new Set(row.coverageAreas.map(coverageLabel).filter((l) => l.length > 0))],
    paymentTypes: [...new Set(row.paymentTypes.map((p) => p.paymentType.name))],
    languages: [...new Set(row.languages.map((l) => l.language.name))],
    hours: row.hours.map((h) => ({ day: h.dayOfWeek, closed: h.closed, open24: h.open24, opensAt: h.opensAt, closesAt: h.closesAt })),
  };
}
