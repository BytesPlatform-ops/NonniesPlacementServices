import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../auth/request-user";
import { SeekerCaseAccessService } from "./seeker-case-access";
import {
  currentJourneyStage,
  journeyHeadline,
  journeyView,
  type JourneyStageView,
} from "./seeker-journey";
import {
  humanize,
  seekerCaseInclude,
  toProviderView,
  toRequirementView,
  toServiceView,
  type SeekerCaseRow,
  type SeekerProviderView,
  type SeekerRequirementView,
  type SeekerServiceView,
} from "./seeker.serializer";

export interface SeekerCaseSummary {
  caseId: string;
  caseNumber: string;
  careRecipientName: string;
  relationship: string | null;
}

export interface SeekerDashboardView extends SeekerCaseSummary {
  statusHeadline: string;
  currentStage: string;
  journey: JourneyStageView[];
  assignedCoordinatorName: string | null;
  latestUpdate: { label: string; at: string } | null;
  nextAction: string | null;
  activeMatchCount: number;
  documentsNeededCount: number;
  newMessageCount: number;
  upcomingAppointment: {
    id: string;
    type: string;
    providerName: string | null;
    scheduledAt: string | null;
    locationText: string | null;
    status: string;
  } | null;
  selectedProvider: {
    referralId: string;
    providerName: string;
    city: string | null;
    state: string | null;
    phone: string | null;
    placementStatus: string | null;
    placementStatusLabel: string | null;
    scheduledStartAt: string | null;
    actualStartAt: string | null;
    serviceStarted: boolean;
  } | null;
  anticipatedStartDate: string | null;
}

export interface SeekerCarePlanView extends SeekerCaseSummary {
  services: SeekerServiceView[];
  requirements: SeekerRequirementView[];
  careDetails: {
    currentCareSetting: string | null;
    preferredServiceLocation: string | null;
    primaryLanguage: string | null;
    interpreterRequired: boolean;
    communicationPreference: string | null;
    accessibilityNeeds: string[];
    expectedDischargeDate: string | null;
    preferredStartDate: string | null;
    fundingSources: string[];
    equipmentNeeds: string[];
    transportationRequired: boolean;
  };
}

const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Accepted",
  COORDINATING: "Being coordinated",
  SCHEDULED: "Start date scheduled",
  STARTED: "Service started",
  UNSUCCESSFUL: "Did not go ahead",
  CANCELLED: "Cancelled",
};

/** Workflow event types a family should never see on their timeline. */
const INTERNAL_EVENT_TYPES = new Set([
  "INTERNAL_NOTE_ADDED",
  "NOTE_ADDED",
  "PROVIDER_MESSAGE_SENT",
  "CASE_MESSAGE_SENT",
  "REFERRAL_NOTIFICATION_SENT",
  "REFERRAL_NOTIFICATION_FAILED",
  "CASE_ASSIGNED",
  "CASE_REASSIGNED",
  "CASE_UNASSIGNED",
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_REASSIGNED",
  "TASK_STARTED",
  "TASK_COMPLETED",
  "TASK_CANCELLED",
  "TASK_UPDATED",
  "CARE_SEEKER_ACCESS_GRANTED",
  "CARE_SEEKER_ACCESS_REVOKED",
]);

/** Family-friendly wording for the events that do reach the timeline. */
const EVENT_LABELS: Record<string, string> = {
  CASE_CREATED: "Referral received",
  CASE_UPDATED: "Care details updated",
  STATUS_CHANGED: "Status updated",
  REQUIREMENT_ADDED: "A care requirement was added",
  REQUIREMENT_UPDATED: "A care requirement was updated",
  REQUIREMENT_STATUS_CHANGED: "A care requirement was updated",
  SERVICE_REQUEST_ADDED: "A service was added to the care plan",
  SERVICE_REQUEST_UPDATED: "The care plan was updated",
  SERVICE_REQUEST_REMOVED: "A service was removed from the care plan",
  PROVIDER_SELECTION_STARTED: "We started identifying providers",
  REFERRAL_CREATED: "A provider was identified",
  REFERRAL_SENT: "A referral was sent to a provider",
  REFERRAL_VIEWED: "A provider opened the referral",
  REFERRAL_INFORMATION_REQUESTED: "A provider asked for more information",
  REFERRAL_INFORMATION_PROVIDED: "We sent the provider more information",
  REFERRAL_CONDITIONALLY_ACCEPTED: "A provider expressed interest",
  REFERRAL_ACCEPTED: "A provider accepted",
  REFERRAL_DECLINED: "A provider was unable to accept",
  REFERRAL_WITHDRAWN: "A referral was withdrawn",
  PLACEMENT_CREATED: "Placement confirmed",
  SERVICE_START_SCHEDULED: "A start date was scheduled",
  SERVICE_STARTED: "Care started",
  SERVICE_START_UNSUCCESSFUL: "The scheduled start did not go ahead",
  CASE_CANCELLED: "The case was closed",
  CARE_SEEKER_MESSAGE_SENT: "You sent a message",
  DOCUMENT_REQUESTED: "A document was requested",
  DOCUMENT_UPLOADED: "A document was uploaded",
  DOCUMENT_ACCEPTED: "A document was accepted",
  DOCUMENT_UPDATE_REQUESTED: "A document needs updating",
  APPOINTMENT_REQUESTED: "A tour was requested",
  APPOINTMENT_SCHEDULED: "A tour was scheduled",
  APPOINTMENT_RESCHEDULE_REQUESTED: "A reschedule was requested",
  APPOINTMENT_COMPLETED: "A tour was completed",
  APPOINTMENT_CANCELLED: "A tour was cancelled",
};

/** The assigned professional's display name, or null when there is none. */
function coordinatorName(
  coordinator: { displayName: string | null; firstName: string | null; lastName: string | null } | null,
): string | null {
  if (!coordinator) return null;
  if (coordinator.displayName) return coordinator.displayName;
  const full = [coordinator.firstName, coordinator.lastName].filter(Boolean).join(" ");
  return full || null;
}

/** Where to go: the explicit location, else the provider's address. */
function appointmentLocation(appointment: {
  locationText: string | null;
  provider: { addressLine1: string | null; city: string | null; state: string | null } | null;
}): string | null {
  if (appointment.locationText) return appointment.locationText;
  const parts = [appointment.provider?.addressLine1, appointment.provider?.city, appointment.provider?.state];
  const joined = parts.filter(Boolean).join(", ");
  return joined || null;
}

@Injectable()
export class SeekerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SeekerCaseAccessService,
  ) {}

  /** Every case this family member may open, for the case switcher. */
  listCases(user: RequestUser): SeekerCaseSummary[] {
    return user.caseAccess.map((a) => ({
      caseId: a.caseId,
      caseNumber: a.caseNumber,
      careRecipientName: a.careRecipientName,
      relationship: a.relationship,
    }));
  }

  private async loadCase(user: RequestUser, caseId?: string | null): Promise<{ row: SeekerCaseRow; summary: SeekerCaseSummary }> {
    const grant = this.access.resolveCase(user, caseId);
    const row = await this.prisma.case.findUnique({ where: { id: grant.caseId }, include: seekerCaseInclude });
    // The grant is resolved before the read, so a missing row here means the
    // case was deleted between requests rather than an access failure.
    if (!row) throw new NotFoundException(`Case ${grant.caseId} not found`);
    return {
      row,
      summary: {
        caseId: grant.caseId,
        caseNumber: grant.caseNumber,
        careRecipientName: grant.careRecipientName,
        relationship: grant.relationship,
      },
    };
  }

  async dashboard(user: RequestUser, caseId?: string | null): Promise<SeekerDashboardView> {
    const { row, summary } = await this.loadCase(user, caseId);

    const acceptedReferral = row.referrals.find((r) => r.status === "ACCEPTED") ?? null;
    const placement = acceptedReferral?.placement ?? row.referrals.map((r) => r.placement).find(Boolean) ?? null;
    const now = new Date();
    const upcoming = row.appointments.find(
      (a) => a.scheduledAt !== null && a.scheduledAt >= now && (a.status === "SCHEDULED" || a.status === "CONFIRMED"),
    );

    const stage = currentJourneyStage({
      caseStatus: row.status,
      referralStatuses: row.referrals.map((r) => r.status),
      placementStatus: placement?.status ?? null,
      hasScheduledAppointment: row.appointments.some(
        (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED" || a.status === "COMPLETED",
      ),
    });

    const [latestEvent, documentsNeededCount, newMessageCount, coordinator] = await Promise.all([
      this.latestVisibleEvent(row.id),
      this.prisma.caseDocument.count({
        where: { caseId: row.id, requestedFromSeeker: true, status: { in: ["REQUESTED", "NEEDS_UPDATE"] } },
      }),
      this.newMessageCount(row.id, user.id),
      row.assignedDischargeProfessionalId
        ? this.prisma.user.findUnique({
            where: { id: row.assignedDischargeProfessionalId },
            select: { displayName: true, firstName: true, lastName: true },
          })
        : Promise.resolve(null),
    ]);

    const activeMatchCount = row.referrals.filter(
      (r) => r.status !== "WITHDRAWN" && r.status !== "CANCELLED" && r.status !== "DECLINED" && r.status !== "DRAFT",
    ).length;

    return {
      ...summary,
      statusHeadline: journeyHeadline(stage),
      currentStage: stage,
      journey: journeyView({
        caseStatus: row.status,
        referralStatuses: row.referrals.map((r) => r.status),
        placementStatus: placement?.status ?? null,
        hasScheduledAppointment: row.appointments.some(
          (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED" || a.status === "COMPLETED",
        ),
      }),
      assignedCoordinatorName: coordinatorName(coordinator),
      latestUpdate: latestEvent,
      nextAction: this.nextAction({ documentsNeededCount, upcoming: upcoming ?? null, stage }),
      activeMatchCount,
      documentsNeededCount,
      newMessageCount,
      upcomingAppointment: upcoming
        ? {
            id: upcoming.id,
            type: humanize(upcoming.type),
            providerName: upcoming.provider?.displayName ?? null,
            scheduledAt: upcoming.scheduledAt ? upcoming.scheduledAt.toISOString() : null,
            locationText: appointmentLocation(upcoming),
            status: humanize(upcoming.status),
          }
        : null,
      selectedProvider: acceptedReferral
        ? {
            referralId: acceptedReferral.id,
            providerName: acceptedReferral.provider.displayName,
            city: acceptedReferral.provider.city,
            state: acceptedReferral.provider.state,
            phone: acceptedReferral.provider.phone,
            placementStatus: placement?.status ?? null,
            placementStatusLabel: placement ? (PLACEMENT_STATUS_LABELS[placement.status] ?? humanize(placement.status)) : null,
            scheduledStartAt: placement?.scheduledStartAt?.toISOString() ?? null,
            actualStartAt: placement?.actualStartAt?.toISOString() ?? null,
            // Kept as its own flag rather than inferred from a date, so the UI
            // can never imply care has begun from a scheduled date alone.
            serviceStarted: placement?.status === "STARTED",
          }
        : null,
      anticipatedStartDate:
        placement?.scheduledStartAt?.toISOString() ?? row.expectedDischargeDate?.toISOString() ?? null,
    };
  }

  async carePlan(user: RequestUser, caseId?: string | null): Promise<SeekerCarePlanView> {
    const { row, summary } = await this.loadCase(user, caseId);

    const fundingSources = [
      ...new Set(
        row.serviceRequests.flatMap((s) => [s.fundingSource, s.insurancePlan].filter((v): v is string => Boolean(v))),
      ),
    ];
    const equipmentNeeds = [
      ...new Set(row.serviceRequests.map((s) => s.equipmentNeeds).filter((v): v is string => Boolean(v))),
    ];
    const preferredStart = row.serviceRequests
      .map((s) => s.requestedStartDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      ...summary,
      services: row.serviceRequests.map(toServiceView),
      requirements: row.requirements.filter((r) => r.status !== "NOT_REQUIRED").map(toRequirementView),
      careDetails: {
        currentCareSetting: row.currentCareSetting ? humanize(row.currentCareSetting) : null,
        preferredServiceLocation: row.preferredServiceLocation,
        primaryLanguage: row.primaryLanguage,
        interpreterRequired: row.interpreterRequired,
        communicationPreference: row.communicationPreference,
        accessibilityNeeds: row.accessibilityNeeds,
        expectedDischargeDate: row.expectedDischargeDate?.toISOString() ?? null,
        preferredStartDate: preferredStart?.toISOString() ?? null,
        fundingSources,
        equipmentNeeds,
        transportationRequired: row.serviceRequests.some((s) => s.transportationRequired),
      },
    };
  }

  async matches(user: RequestUser, caseId?: string | null): Promise<{ case: SeekerCaseSummary; providers: SeekerProviderView[] }> {
    const { row, summary } = await this.loadCase(user, caseId);
    return {
      case: summary,
      // DRAFT referrals are internal preparation — a provider has not been
      // contacted yet, so showing one would promise a conversation that has not
      // happened.
      providers: row.referrals.filter((r) => r.status !== "DRAFT").map((r) => toProviderView(r, row.serviceRequests)),
    };
  }

  async match(user: RequestUser, referralId: string): Promise<SeekerProviderView> {
    await this.access.requireReferral(user, referralId);
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      include: { case: { include: seekerCaseInclude } },
    });
    if (!referral || referral.status === "DRAFT") throw new NotFoundException(`Referral ${referralId} not found`);
    const full = referral.case.referrals.find((r) => r.id === referralId);
    if (!full) throw new NotFoundException(`Referral ${referralId} not found`);
    return toProviderView(full, referral.case.serviceRequests);
  }

  async progress(user: RequestUser, caseId?: string | null): Promise<{ case: SeekerCaseSummary; milestones: Array<{ id: string; label: string; at: string }> }> {
    const { row, summary } = await this.loadCase(user, caseId);
    const events = await this.prisma.workflowEvent.findMany({
      where: { caseId: row.id, type: { notIn: [...INTERNAL_EVENT_TYPES] as never } },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, createdAt: true },
    });
    return {
      case: summary,
      milestones: events.map((e) => ({
        id: e.id,
        label: EVENT_LABELS[e.type] ?? humanize(e.type),
        at: e.createdAt.toISOString(),
      })),
    };
  }

  // ---- helpers ----

  private async latestVisibleEvent(caseId: string): Promise<{ label: string; at: string } | null> {
    const event = await this.prisma.workflowEvent.findFirst({
      where: { caseId, type: { notIn: [...INTERNAL_EVENT_TYPES] as never } },
      orderBy: { createdAt: "desc" },
      select: { type: true, createdAt: true },
    });
    if (!event) return null;
    return { label: EVENT_LABELS[event.type] ?? humanize(event.type), at: event.createdAt.toISOString() };
  }

  /**
   * Replies the family has not seen yet.
   *
   * Case messages have no per-user read state, and inventing one would mean a
   * new table for a badge. "Since your own last message" is a real, honest
   * measure of what is new to them, and the UI labels it that way rather than
   * claiming to know what they have read.
   */
  private async newMessageCount(caseId: string, userId: string): Promise<number> {
    const own = await this.prisma.message.findFirst({
      where: { caseId, scope: "CARE_SEEKER", senderUserId: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return this.prisma.message.count({
      where: {
        caseId,
        scope: "CARE_SEEKER",
        senderUserId: { not: userId },
        ...(own ? { createdAt: { gt: own.createdAt } } : {}),
      },
    });
  }

  private nextAction(input: {
    documentsNeededCount: number;
    upcoming: { scheduledAt: Date | null; status: string } | null;
    stage: string;
  }): string | null {
    if (input.documentsNeededCount > 0) {
      return input.documentsNeededCount === 1
        ? "One document is still needed. You can upload it under Documents."
        : `${input.documentsNeededCount} documents are still needed. You can upload them under Documents.`;
    }
    if (input.upcoming?.status === "SCHEDULED") {
      return "A tour has been scheduled. Please confirm it under Tours & Appointments.";
    }
    if (input.stage === "PROVIDERS_REVIEWING") {
      return "Nothing is needed from you right now. We will let you know as providers respond.";
    }
    return null;
  }
}
