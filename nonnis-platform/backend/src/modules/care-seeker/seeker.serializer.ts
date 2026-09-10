import { Prisma } from "@prisma/client";
import {
  ARRANGEMENT_LABELS,
  AVAILABILITY_LABELS,
  seekerAvailability,
  serviceArrangement,
  type SeekerAvailability,
  type ServiceArrangement,
} from "./seeker-status";

/**
 * Family-facing projections.
 *
 * The rule every shape here obeys: a family sees their own case and the
 * providers being considered for it, and nothing that belongs to the platform's
 * internal operation. Concretely, these views never carry internal notes,
 * eligibility notes, licence details, bed counts, organization or user ids,
 * storage paths, staff commentary, or another case's data.
 *
 * That is enforced by projecting field by field rather than spreading a row —
 * a new column added to Provider or Case tomorrow cannot leak through here by
 * accident, because nothing reaches the family unless it is written out below.
 */

// ---------------------------------------------------------------------------
// Prisma includes
// ---------------------------------------------------------------------------

/** Provider fields a family may see. Mirrors the public directory projection. */
export const seekerProviderInclude = {
  services: {
    where: { active: true },
    select: { serviceCategory: { select: { id: true, code: true, name: true } }, description: true, levelOfCare: true },
    orderBy: { createdAt: "asc" },
  },
  languages: { where: { active: true }, select: { language: { select: { name: true } } } },
  paymentTypes: { where: { active: true }, select: { paymentType: { select: { name: true } } } },
  coverageAreas: { where: { active: true }, orderBy: { createdAt: "asc" } },
  hours: { orderBy: { dayOfWeek: "asc" } },
  // Capacity STATUS only. `availableCount` and `notes` are deliberately not
  // selected, so no bed number can reach a family even by mistake.
  capacity: { select: { status: true, serviceCategoryId: true } },
} satisfies Prisma.ProviderInclude;

export const seekerCaseInclude = {
  patient: { select: { firstName: true, lastName: true, dateOfBirth: true } },
  serviceRequests: {
    orderBy: { createdAt: "asc" },
    include: {
      serviceCategory: { select: { id: true, code: true, name: true } },
      referrals: { select: { status: true } },
    },
  },
  requirements: { orderBy: { createdAt: "asc" } },
  referrals: {
    orderBy: { createdAt: "asc" },
    include: {
      provider: { include: seekerProviderInclude },
      serviceRequest: { select: { id: true, category: true, serviceCategory: { select: { name: true } } } },
      placement: true,
    },
  },
  appointments: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }], include: { provider: { select: { displayName: true, city: true, state: true, addressLine1: true } } } },
} satisfies Prisma.CaseInclude;

export type SeekerCaseRow = Prisma.CaseGetPayload<{ include: typeof seekerCaseInclude }>;
export type SeekerReferralRow = SeekerCaseRow["referrals"][number];
export type SeekerProviderRow = SeekerReferralRow["provider"];

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface SeekerServiceView {
  id: string;
  name: string;
  levelOfCare: string | null;
  frequency: string | null;
  requestedStartDate: string | null;
  arrangement: ServiceArrangement;
  arrangementLabel: string;
}

export interface SeekerRequirementView {
  id: string;
  label: string;
  detail: string | null;
  category: string;
  mandatory: boolean;
  status: string;
  statusLabel: string;
  dueDate: string | null;
}

export interface SeekerProviderView {
  referralId: string;
  providerName: string;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  summary: string | null;
  services: Array<{ name: string; levelOfCare: string | null; description: string | null }>;
  languages: string[];
  paymentTypes: string[];
  availability: SeekerAvailability;
  availabilityLabel: string;
  /** Services this case asked for that this provider offers. */
  servicesCovered: string[];
  /** Services this case asked for that this provider does not list. */
  servicesNotCovered: string[];
  respondedAt: string | null;
  isSelected: boolean;
}

const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Still needed",
  IN_PROGRESS: "In progress",
  BLOCKED: "Needs attention",
  COMPLETE: "Confirmed",
  NOT_REQUIRED: "Not required",
};

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** Title-cases an enum-ish code so no screaming snake case reaches a family. */
export function humanize(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function toServiceView(row: SeekerCaseRow["serviceRequests"][number]): SeekerServiceView {
  const arrangement = serviceArrangement({
    serviceRequestStatus: row.status,
    referralStatuses: row.referrals.map((r) => r.status),
  });
  return {
    id: row.id,
    // The admin-managed catalog name when linked, otherwise the stable enum
    // rendered readably — never the raw enum.
    name: row.serviceCategory?.name ?? humanize(row.category),
    levelOfCare: row.levelOfCare ? humanize(row.levelOfCare) : null,
    frequency: row.frequency,
    requestedStartDate: iso(row.requestedStartDate),
    arrangement,
    arrangementLabel: ARRANGEMENT_LABELS[arrangement],
  };
}

export function toRequirementView(row: SeekerCaseRow["requirements"][number]): SeekerRequirementView {
  return {
    id: row.id,
    label: row.label,
    detail: row.detail,
    category: humanize(row.category),
    mandatory: row.mandatory,
    status: row.status,
    statusLabel: REQUIREMENT_STATUS_LABELS[row.status] ?? humanize(row.status),
    dueDate: iso(row.dueDate),
    // `notes` and `completedByUserId` are intentionally not projected: the notes
    // are staff working commentary and the user id is internal identity.
  };
}

/**
 * Compares what the case asked for against what a provider offers.
 *
 * Matched on the service-category code, which both sides share:
 * `ServiceRequest.category` is the stable enum and `ServiceCategory.code`
 * mirrors it, so this holds whether or not a request has been linked to the
 * admin-managed catalog yet.
 */
export function compareServices(
  requested: SeekerCaseRow["serviceRequests"],
  provider: SeekerProviderRow,
): { covered: string[]; notCovered: string[] } {
  const offered = new Set(provider.services.map((s) => s.serviceCategory.code));
  const covered: string[] = [];
  const notCovered: string[] = [];
  for (const req of requested) {
    if (req.status === "CANCELLED") continue;
    const code = req.serviceCategory?.code ?? req.category;
    const name = req.serviceCategory?.name ?? humanize(req.category);
    if (covered.includes(name) || notCovered.includes(name)) continue;
    (offered.has(code) ? covered : notCovered).push(name);
  }
  return { covered, notCovered };
}

export function toProviderView(
  referral: SeekerReferralRow,
  requestedServices: SeekerCaseRow["serviceRequests"],
): SeekerProviderView {
  const provider = referral.provider;
  // One capacity row may exist per service category; the referral's own
  // category is the relevant one, falling back to the provider-wide row.
  const capacityRow =
    provider.capacity.find((c) => c.serviceCategoryId === null) ?? provider.capacity[0] ?? null;

  const availability = seekerAvailability({
    referralStatus: referral.status,
    declineReason: null,
    placementStatus: referral.placement?.status ?? null,
    capacityStatus: capacityRow?.status ?? null,
  });
  const { covered, notCovered } = compareServices(requestedServices, provider);

  return {
    referralId: referral.id,
    providerName: provider.displayName,
    city: provider.city,
    state: provider.state,
    imageUrl: provider.publicFeaturedImageUrl,
    summary: provider.publicDescription ?? provider.description,
    services: provider.services.map((s) => ({
      name: s.serviceCategory.name,
      levelOfCare: s.levelOfCare ? humanize(s.levelOfCare) : null,
      description: s.description,
    })),
    languages: [...new Set(provider.languages.map((l) => l.language.name))],
    paymentTypes: [...new Set(provider.paymentTypes.map((p) => p.paymentType.name))],
    availability,
    availabilityLabel: AVAILABILITY_LABELS[availability],
    servicesCovered: covered,
    servicesNotCovered: notCovered,
    respondedAt: iso(referral.lastResponseAt),
    isSelected: referral.status === "ACCEPTED",
    // Never projected: internalNotes, eligibilityNotes, licenceNumber/type,
    // organizationId, provider staff, capacity counts, coordination notes.
  };
}
