import { Prisma } from "@prisma/client";
import { computeReadiness, type ReadinessInput, type ReadinessPlacement, type ReadinessResult } from "./readiness-domain";

/**
 * Single source of truth for the case query that feeds readiness, plus the
 * mapping from Prisma rows to the pure `ReadinessInput`. Readiness is always
 * derived live from these source-of-truth records — never a persisted column.
 */
export const readinessCaseInclude = {
  requirements: { select: { id: true, category: true, status: true, mandatory: true, label: true } },
  serviceRequests: {
    select: {
      id: true,
      category: true,
      status: true,
      levelOfCare: true,
      requestedStartDate: true,
      transportationRequired: true,
      equipmentNeeds: true,
      fundingSource: true,
      insurancePlan: true,
      referrals: {
        where: { status: "ACCEPTED" },
        select: { placement: { select: { status: true, scheduledStartAt: true, actualStartAt: true } } },
      },
    },
  },
} satisfies Prisma.CaseInclude;

export type ReadinessCaseRow = Prisma.CaseGetPayload<{ include: typeof readinessCaseInclude }>;

/** Resolve the authoritative placement for a service request from its accepted referrals. */
function resolvePlacement(referrals: ReadinessCaseRow["serviceRequests"][number]["referrals"]): ReadinessPlacement | null {
  const placements = referrals
    .map((r) => r.placement)
    .filter((p): p is NonNullable<typeof p> => p !== null && p.status !== "CANCELLED");
  if (placements.length === 0) return null;
  // Prefer a live (non-unsuccessful) placement; otherwise surface the unsuccessful one.
  const live = placements.find((p) => p.status !== "UNSUCCESSFUL");
  return live ?? placements[0]!;
}

export function toReadinessInput(row: ReadinessCaseRow): ReadinessInput {
  return {
    status: row.status,
    blocked: row.blocked,
    assignedProfessionalId: row.assignedDischargeProfessionalId,
    expectedDischargeDate: row.expectedDischargeDate,
    actualDischargeDate: row.actualDischargeDate,
    currentCareSetting: row.currentCareSetting,
    preferredServiceLocation: row.preferredServiceLocation,
    patientContactPhone: row.patientContactPhone,
    representativeContact: row.representativeContact,
    createdAt: row.createdAt,
    requirements: row.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
      mandatory: r.mandatory,
      label: r.label,
    })),
    serviceRequests: row.serviceRequests.map((s) => ({
      id: s.id,
      category: s.category,
      status: s.status,
      levelOfCare: s.levelOfCare,
      requestedStartDate: s.requestedStartDate,
      transportationRequired: s.transportationRequired,
      equipmentNeeds: s.equipmentNeeds,
      fundingSource: s.fundingSource,
      insurancePlan: s.insurancePlan,
      placement: resolvePlacement(s.referrals),
    })),
  };
}

export interface ReadinessView extends ReadinessResult {
  caseId: string;
  status: ReadinessCaseRow["status"];
  lastEvaluatedAt: string;
}

export function toReadinessView(row: ReadinessCaseRow, now: Date = new Date()): ReadinessView {
  const result = computeReadiness(toReadinessInput(row));
  return { caseId: row.id, status: row.status, lastEvaluatedAt: now.toISOString(), ...result };
}
