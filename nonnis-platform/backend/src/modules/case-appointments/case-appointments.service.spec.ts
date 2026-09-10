import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CaseAppointmentsService } from "./case-appointments.service";
import type { PrismaService } from "../../database/prisma.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";

function appt(overrides: Record<string, unknown> = {}) {
  return {
    id: "appt-1",
    caseId: "case-a",
    type: "TOUR",
    status: "SCHEDULED",
    providerId: "prov-1",
    referralId: null,
    scheduledAt: new Date("2026-10-01T15:00:00Z"),
    durationMinutes: 60,
    locationText: null,
    instructions: null,
    seekerNote: null,
    outcomeNote: null,
    cancelReason: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    provider: { displayName: "Angels of Cascades", addressLine1: "1 Elm St", city: "Tacoma", state: "WA" },
    ...overrides,
  };
}

function build(existing = appt()) {
  const findFirst = jest.fn().mockResolvedValue(existing);
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(appt({ ...existing, ...data })));
  const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(appt({ ...appt(), ...data })));
  const prisma = {
    caseAppointment: { findFirst, update, create, findMany: jest.fn().mockResolvedValue([existing]) },
  } as unknown as PrismaService;
  const events = { record: jest.fn().mockResolvedValue(undefined) } as unknown as WorkflowEventsService;
  return { svc: new CaseAppointmentsService(prisma, events), findFirst, update, create, events };
}

describe("CaseAppointmentsService", () => {
  describe("toView", () => {
    it("falls back to the provider address when no location was written", () => {
      const view = CaseAppointmentsService.toView(appt() as never);
      expect(view.locationText).toBe("1 Elm St, Tacoma, WA");
    });

    it("prefers an explicit location", () => {
      const view = CaseAppointmentsService.toView(appt({ locationText: "Main entrance" }) as never);
      expect(view.locationText).toBe("Main entrance");
    });

    it("uses human labels rather than raw enums", () => {
      const view = CaseAppointmentsService.toView(appt({ type: "MOVE_IN", status: "RESCHEDULE_REQUESTED" }) as never);
      expect(view.typeLabel).toBe("Move-in");
      expect(view.statusLabel).toBe("Reschedule requested");
    });

    it("marks a past or finished appointment", () => {
      const now = new Date("2026-11-01T00:00:00Z");
      expect(CaseAppointmentsService.toView(appt() as never, now).isPast).toBe(true);
      expect(CaseAppointmentsService.toView(appt({ status: "COMPLETED" }) as never, new Date("2026-01-01")).isPast).toBe(true);
      expect(CaseAppointmentsService.toView(appt() as never, new Date("2026-01-01")).isPast).toBe(false);
    });
  });

  describe("staff scheduling", () => {
    it("creates a scheduled appointment when a time is given", async () => {
      const { svc, create } = build();
      await svc.create({ caseId: "case-a", organizationId: "org", scheduledAt: new Date() }, "staff-1");
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED" }) }),
      );
    });

    it("leaves an appointment as a request when no time is given", async () => {
      const { svc, create } = build();
      await svc.create({ caseId: "case-a", organizationId: "org" }, "staff-1");
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "REQUESTED" }) }),
      );
    });

    it("advances a family request to scheduled when staff put a time on it", async () => {
      const { svc, update } = build(appt({ status: "REQUESTED", scheduledAt: null }));
      await svc.update(
        { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", scheduledAt: new Date() },
        "staff-1",
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED" }) }),
      );
    });

    it("requires a reason to cancel", async () => {
      const { svc } = build();
      await expect(
        svc.update({ caseId: "case-a", organizationId: "org", appointmentId: "appt-1", status: "CANCELLED" }, "staff-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("404s for an appointment on another case", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const prisma = { caseAppointment: { findFirst } } as unknown as PrismaService;
      const svc = new CaseAppointmentsService(prisma, { record: jest.fn() } as unknown as WorkflowEventsService);
      await expect(
        svc.update({ caseId: "case-b", organizationId: "org", appointmentId: "appt-1" }, "staff-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("family responses", () => {
    it("creates a request with no time — only staff agree one with the provider", async () => {
      const { svc, create } = build();
      await svc.requestFromSeeker({ caseId: "case-a", organizationId: "org", note: "Weekday mornings suit us" }, "fam-1");
      const data = create.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.status).toBe("REQUESTED");
      expect(data.scheduledAt).toBeUndefined();
      expect(data.requestedByUserId).toBe("fam-1");
      expect(data.seekerNote).toBe("Weekday mornings suit us");
    });

    it("confirms a scheduled appointment", async () => {
      const { svc, update } = build();
      await svc.respondAsSeeker(
        { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "CONFIRM" },
        "fam-1",
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) }),
      );
    });

    it("refuses to confirm before a time exists", async () => {
      const { svc } = build(appt({ status: "REQUESTED", scheduledAt: null }));
      await expect(
        svc.respondAsSeeker(
          { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "CONFIRM" },
          "fam-1",
        ),
      ).rejects.toThrow(/nothing to confirm/i);
    });

    it("records a reschedule request without changing the time itself", async () => {
      const { svc, update } = build();
      await svc.respondAsSeeker(
        { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "REQUEST_RESCHEDULE", note: "Clash" },
        "fam-1",
      );
      const data = update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.status).toBe("RESCHEDULE_REQUESTED");
      // The family asks; staff decide the new time.
      expect(data).not.toHaveProperty("scheduledAt");
    });

    it("cancels with the family's own reason", async () => {
      const { svc, update } = build();
      await svc.respondAsSeeker(
        { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "CANCEL", note: "No longer needed" },
        "fam-1",
      );
      const data = update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.status).toBe("CANCELLED");
      expect(data.cancelReason).toBe("No longer needed");
    });

    it("refuses to change a completed or cancelled appointment", async () => {
      for (const status of ["COMPLETED", "CANCELLED"]) {
        const { svc } = build(appt({ status }));
        await expect(
          svc.respondAsSeeker(
            { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "CONFIRM" },
            "fam-1",
          ),
        ).rejects.toThrow(/no longer be changed/i);
      }
    });

    it("never writes a staff-only field", async () => {
      // The family transition writes exactly these keys and no others.
      const { svc, update } = build();
      await svc.respondAsSeeker(
        { caseId: "case-a", organizationId: "org", appointmentId: "appt-1", action: "CONFIRM" },
        "fam-1",
      );
      const data = update.mock.calls[0][0].data as Record<string, unknown>;
      for (const staffOnly of ["outcomeNote", "instructions", "locationText", "durationMinutes", "providerId", "completedAt"]) {
        expect(data).not.toHaveProperty(staffOnly);
      }
    });
  });
});
