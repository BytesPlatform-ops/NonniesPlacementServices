import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CaseAppointmentStatus, CaseAppointmentType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";

export interface CaseAppointmentView {
  id: string;
  type: CaseAppointmentType;
  typeLabel: string;
  status: CaseAppointmentStatus;
  statusLabel: string;
  providerId: string | null;
  providerName: string | null;
  referralId: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  locationText: string | null;
  instructions: string | null;
  seekerNote: string | null;
  outcomeNote: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  createdAt: string;
  /** True once the appointment is in the past or has been completed. */
  isPast: boolean;
}

const TYPE_LABELS: Record<CaseAppointmentType, string> = {
  TOUR: "Tour",
  ASSESSMENT: "Assessment",
  MEETING: "Meeting",
  MOVE_IN: "Move-in",
  OTHER: "Appointment",
};

const STATUS_LABELS: Record<CaseAppointmentStatus, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  RESCHEDULE_REQUESTED: "Reschedule requested",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type AppointmentRow = {
  id: string;
  type: CaseAppointmentType;
  status: CaseAppointmentStatus;
  providerId: string | null;
  referralId: string | null;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  locationText: string | null;
  instructions: string | null;
  seekerNote: string | null;
  outcomeNote: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  provider: { displayName: string; addressLine1: string | null; city: string | null; state: string | null } | null;
};

const providerSelect = { select: { displayName: true, addressLine1: true, city: true, state: true } } as const;

/**
 * Tours, assessments and meetings on a case.
 *
 * Shared by the staff console and the family portal, in the same shape as case
 * documents: authorization happens in the controllers, business rules live here
 * once. Staff schedule and complete; families request, confirm, ask to move,
 * and cancel — the two sets of transitions are enforced separately below so a
 * family can never write a staff-only field.
 */
@Injectable()
export class CaseAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
  ) {}

  static toView(row: AppointmentRow, now = new Date()): CaseAppointmentView {
    const location =
      row.locationText ??
      ([row.provider?.addressLine1, row.provider?.city, row.provider?.state].filter(Boolean).join(", ") || null);
    return {
      id: row.id,
      type: row.type,
      typeLabel: TYPE_LABELS[row.type],
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      providerId: row.providerId,
      providerName: row.provider?.displayName ?? null,
      referralId: row.referralId,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      durationMinutes: row.durationMinutes,
      locationText: location,
      instructions: row.instructions,
      seekerNote: row.seekerNote,
      outcomeNote: row.outcomeNote,
      cancelReason: row.cancelReason,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      isPast:
        row.status === "COMPLETED" ||
        row.status === "CANCELLED" ||
        (row.scheduledAt !== null && row.scheduledAt < now),
    };
  }

  async list(caseId: string): Promise<CaseAppointmentView[]> {
    const rows = await this.prisma.caseAppointment.findMany({
      where: { caseId },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      include: { provider: providerSelect },
    });
    return rows.map((r) => CaseAppointmentsService.toView(r));
  }

  private async load(caseId: string, appointmentId: string) {
    const row = await this.prisma.caseAppointment.findFirst({
      where: { id: appointmentId, caseId },
      include: { provider: providerSelect },
    });
    if (!row) throw new NotFoundException(`Appointment ${appointmentId} not found`);
    return row;
  }

  // ---- staff transitions ----

  /** Staff create or schedule an appointment. */
  async create(
    input: {
      caseId: string;
      organizationId: string;
      type?: CaseAppointmentType;
      providerId?: string | null;
      referralId?: string | null;
      scheduledAt?: Date | null;
      durationMinutes?: number | null;
      locationText?: string | null;
      instructions?: string | null;
    },
    actorUserId: string,
  ): Promise<CaseAppointmentView> {
    const row = await this.prisma.caseAppointment.create({
      data: {
        caseId: input.caseId,
        type: input.type ?? "TOUR",
        providerId: input.providerId ?? null,
        referralId: input.referralId ?? null,
        scheduledAt: input.scheduledAt ?? null,
        durationMinutes: input.durationMinutes ?? null,
        locationText: input.locationText ?? null,
        instructions: input.instructions ?? null,
        // A time makes it scheduled; without one it is still only an intention.
        status: input.scheduledAt ? "SCHEDULED" : "REQUESTED",
        createdByUserId: actorUserId,
      },
      include: { provider: providerSelect },
    });
    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: input.scheduledAt ? "APPOINTMENT_SCHEDULED" : "APPOINTMENT_REQUESTED",
      actorUserId,
      source: "MANUAL",
      metadata: { appointmentId: row.id, type: row.type },
    });
    return CaseAppointmentsService.toView(row);
  }

  async update(
    input: {
      caseId: string;
      organizationId: string;
      appointmentId: string;
      type?: CaseAppointmentType;
      providerId?: string | null;
      scheduledAt?: Date | null;
      durationMinutes?: number | null;
      locationText?: string | null;
      instructions?: string | null;
      outcomeNote?: string | null;
      status?: CaseAppointmentStatus;
      cancelReason?: string | null;
    },
    actorUserId: string,
  ): Promise<CaseAppointmentView> {
    const existing = await this.load(input.caseId, input.appointmentId);

    // Scheduling a time on an appointment that was only requested advances it,
    // unless the caller set a status explicitly.
    const status =
      input.status ??
      (input.scheduledAt && (existing.status === "REQUESTED" || existing.status === "RESCHEDULE_REQUESTED")
        ? "SCHEDULED"
        : existing.status);

    if (status === "CANCELLED" && !input.cancelReason?.trim() && !existing.cancelReason) {
      throw new BadRequestException("Give a reason when cancelling an appointment.");
    }

    const row = await this.prisma.caseAppointment.update({
      where: { id: existing.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.locationText !== undefined ? { locationText: input.locationText } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.outcomeNote !== undefined ? { outcomeNote: input.outcomeNote } : {}),
        ...(input.cancelReason !== undefined ? { cancelReason: input.cancelReason } : {}),
        status,
        ...(status === "COMPLETED" && !existing.completedAt ? { completedAt: new Date() } : {}),
        ...(status === "CANCELLED" && !existing.cancelledAt ? { cancelledAt: new Date() } : {}),
      },
      include: { provider: providerSelect },
    });

    const eventType =
      status === "COMPLETED"
        ? "APPOINTMENT_COMPLETED"
        : status === "CANCELLED"
          ? "APPOINTMENT_CANCELLED"
          : "APPOINTMENT_SCHEDULED";
    if (status !== existing.status || input.scheduledAt !== undefined) {
      await this.workflowEvents.record({
        organizationId: input.organizationId,
        caseId: input.caseId,
        type: eventType,
        actorUserId,
        source: "MANUAL",
        metadata: { appointmentId: row.id, status },
      });
    }
    return CaseAppointmentsService.toView(row);
  }

  // ---- family transitions ----

  /**
   * A family asks for a tour. It is created as REQUESTED with no time — only
   * staff put a time on it, because only staff can agree one with the provider.
   */
  async requestFromSeeker(
    input: { caseId: string; organizationId: string; providerId?: string | null; referralId?: string | null; note?: string | null },
    actorUserId: string,
  ): Promise<CaseAppointmentView> {
    const row = await this.prisma.caseAppointment.create({
      data: {
        caseId: input.caseId,
        type: "TOUR",
        status: "REQUESTED",
        providerId: input.providerId ?? null,
        referralId: input.referralId ?? null,
        seekerNote: input.note?.trim() || null,
        requestedByUserId: actorUserId,
      },
      include: { provider: providerSelect },
    });
    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: "APPOINTMENT_REQUESTED",
      actorUserId,
      source: "MANUAL",
      metadata: { appointmentId: row.id, requestedByFamily: true },
    });
    return CaseAppointmentsService.toView(row);
  }

  /**
   * The three responses a family may give to a scheduled appointment.
   *
   * Restricted deliberately: a family can confirm, ask to move, or cancel, but
   * cannot set a time, mark an appointment completed, or write staff fields.
   */
  async respondAsSeeker(
    input: {
      caseId: string;
      organizationId: string;
      appointmentId: string;
      action: "CONFIRM" | "REQUEST_RESCHEDULE" | "CANCEL";
      note?: string | null;
    },
    actorUserId: string,
  ): Promise<CaseAppointmentView> {
    const existing = await this.load(input.caseId, input.appointmentId);
    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new BadRequestException("This appointment can no longer be changed.");
    }
    if (input.action === "CONFIRM" && existing.status !== "SCHEDULED") {
      throw new BadRequestException("There is nothing to confirm until a time has been scheduled.");
    }

    const status: CaseAppointmentStatus =
      input.action === "CONFIRM" ? "CONFIRMED" : input.action === "CANCEL" ? "CANCELLED" : "RESCHEDULE_REQUESTED";

    const row = await this.prisma.caseAppointment.update({
      where: { id: existing.id },
      data: {
        status,
        seekerNote: input.note?.trim() || existing.seekerNote,
        ...(input.action === "CANCEL"
          ? { cancelledAt: new Date(), cancelReason: input.note?.trim() || "Cancelled by the family" }
          : {}),
      },
      include: { provider: providerSelect },
    });

    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type:
        input.action === "CANCEL"
          ? "APPOINTMENT_CANCELLED"
          : input.action === "CONFIRM"
            ? "APPOINTMENT_SCHEDULED"
            : "APPOINTMENT_RESCHEDULE_REQUESTED",
      actorUserId,
      source: "MANUAL",
      metadata: { appointmentId: row.id, byFamily: true, status },
    });
    return CaseAppointmentsService.toView(row);
  }
}
