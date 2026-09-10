import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { CareSeekerAdminService } from "./care-seeker-admin.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { SupabaseService } from "../auth/supabase.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { ConfigService } from "@nestjs/config";

const grantedRow = {
  id: "acc-1",
  userId: "user-1",
  relationship: "Daughter",
  status: "INVITED" as const,
  grantedAt: new Date("2026-09-01T00:00:00Z"),
  revokedAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  user: { email: "family@example.com", displayName: null, firstName: "Ann", lastName: "Miller", status: "INVITED" },
};

function build(opts: { existingUser?: unknown; membershipCount?: number; existingAccess?: unknown; role?: unknown } = {}) {
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.existingUser ?? null),
      create: jest.fn().mockResolvedValue({ id: "user-1", email: "family@example.com" }),
    },
    organizationMembership: { count: jest.fn().mockResolvedValue(opts.membershipCount ?? 0) },
    careSeekerCaseAccess: {
      findUnique: jest.fn().mockResolvedValue(opts.existingAccess ?? null),
      create: jest.fn().mockResolvedValue({ id: "acc-1", relationship: "Daughter" }),
      update: jest.fn().mockResolvedValue({ id: "acc-1", relationship: "Daughter" }),
    },
  };
  const prisma = {
    role: { findUnique: jest.fn().mockResolvedValue(opts.role === undefined ? { id: "role-seeker" } : opts.role) },
    $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
    careSeekerCaseAccess: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(grantedRow),
      findFirst: jest.fn().mockResolvedValue({ id: "acc-1", caseId: "case-a" }),
      findMany: jest.fn().mockResolvedValue([grantedRow]),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...grantedRow, ...data })),
    },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as PrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const supabase = { inviteByEmail: jest.fn().mockResolvedValue({ supabaseUserId: "sb-1" }) } as unknown as SupabaseService;
  const config = { get: jest.fn().mockReturnValue("https://crm.example") } as unknown as ConfigService<never, true>;
  const events = { record: jest.fn().mockResolvedValue(undefined) } as unknown as WorkflowEventsService;
  const svc = new CareSeekerAdminService(prisma, audit, supabase, config as never, events);
  return { svc, prisma, tx, audit, supabase, events };
}

const input = { caseId: "case-a", organizationId: "org-1", email: "Family@Example.com ", relationship: "Daughter" };

describe("CareSeekerAdminService.grant", () => {
  it("creates the application user and sends the existing Supabase invite", async () => {
    const { svc, tx, supabase } = build();
    const view = await svc.grant(input, "staff-1");

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "family@example.com", status: "INVITED" }) }),
    );
    expect(supabase.inviteByEmail).toHaveBeenCalledWith("family@example.com", "https://crm.example/auth/callback");
    expect(view.email).toBe("family@example.com");
    expect(view.statusLabel).toBe("Invited");
  });

  it("reuses an existing user rather than creating a second identity", async () => {
    const { svc, tx } = build({ existingUser: { id: "user-1", email: "family@example.com" } });
    await svc.grant(input, "staff-1");
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  // The two access models must not mix in one session.
  it("refuses to give family access to someone who already has organization access", async () => {
    const { svc } = build({ existingUser: { id: "user-1" }, membershipCount: 1 });
    await expect(svc.grant(input, "staff-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses to grant the same case twice", async () => {
    const { svc } = build({
      existingUser: { id: "user-1" },
      existingAccess: { id: "acc-1", status: "ACTIVE", relationship: null },
    });
    await expect(svc.grant(input, "staff-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("restores a previously revoked grant instead of creating a duplicate row", async () => {
    const { svc, tx } = build({
      existingUser: { id: "user-1" },
      existingAccess: { id: "acc-1", status: "REVOKED", relationship: "Daughter" },
    });
    await svc.grant(input, "staff-1");
    expect(tx.careSeekerCaseAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "INVITED", revokedAt: null }) }),
    );
    expect(tx.careSeekerCaseAccess.create).not.toHaveBeenCalled();
  });

  it("fails clearly when the CARE_SEEKER role has not been synced", async () => {
    const { svc } = build({ role: null });
    await expect(svc.grant(input, "staff-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("records the grant in the audit log and on the case timeline", async () => {
    const { svc, audit, events } = build();
    await svc.grant(input, "staff-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "care_seeker.access_granted" }),
      expect.anything(),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CARE_SEEKER_ACCESS_GRANTED", caseId: "case-a" }),
    );
  });

  it("surfaces a failed invite instead of reporting success", async () => {
    const { svc, prisma } = build();
    (prisma as unknown as { careSeekerCaseAccess: { findUniqueOrThrow: jest.Mock } }).careSeekerCaseAccess.findUniqueOrThrow =
      jest.fn().mockResolvedValue(grantedRow);
    const svcFailing = svc as unknown as { supabase: { inviteByEmail: jest.Mock } };
    svcFailing.supabase.inviteByEmail = jest.fn().mockRejectedValue(new Error("smtp down"));
    await expect(svc.grant(input, "staff-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe("CareSeekerAdminService.setStatus", () => {
  it("revokes with a reason and keeps the row for the audit trail", async () => {
    const { svc, prisma, audit } = build();
    const view = await svc.setStatus(
      { caseId: "case-a", organizationId: "org-1", accessId: "acc-1", status: "REVOKED", reason: "No longer involved" },
      "staff-1",
    );
    const update = (prisma as unknown as { careSeekerCaseAccess: { update: jest.Mock } }).careSeekerCaseAccess.update;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REVOKED", revokedReason: "No longer involved" }) }),
    );
    expect(view.status).toBe("REVOKED");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "care_seeker.access_revoked" }));
  });

  it("restores access by clearing the revocation", async () => {
    const { svc, prisma } = build();
    await svc.setStatus({ caseId: "case-a", organizationId: "org-1", accessId: "acc-1", status: "ACTIVE" }, "staff-1");
    const update = (prisma as unknown as { careSeekerCaseAccess: { update: jest.Mock } }).careSeekerCaseAccess.update;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE", revokedAt: null, revokedReason: null } }),
    );
  });

  it("404s for an access row on a different case", async () => {
    const { svc, prisma } = build();
    (prisma as unknown as { careSeekerCaseAccess: { findFirst: jest.Mock } }).careSeekerCaseAccess.findFirst = jest
      .fn()
      .mockResolvedValue(null);
    await expect(
      svc.setStatus({ caseId: "case-b", organizationId: "org-1", accessId: "acc-1", status: "REVOKED" }, "staff-1"),
    ).rejects.toThrow(/not found/i);
  });
});
