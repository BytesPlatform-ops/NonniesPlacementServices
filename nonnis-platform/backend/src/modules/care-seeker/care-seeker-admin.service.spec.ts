import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CareSeekerAdminService } from "./care-seeker-admin.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { SupabaseService } from "../auth/supabase.service";
import { InvitationEmailError, type InvitationService } from "../auth/invitation.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";

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

function build(
  opts: {
    existingUser?: unknown;
    membershipCount?: number;
    existingAccess?: unknown;
    role?: unknown;
    /** What `careSeekerCaseAccess.findFirst` returns — the row resend and
     *  remove-invitation both start from. */
    accessRow?: unknown;
  } = {},
) {
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.existingUser ?? null),
      create: jest.fn().mockResolvedValue({ id: "user-1", email: "family@example.com" }),
      delete: jest.fn().mockResolvedValue({}),
    },
    organizationMembership: { count: jest.fn().mockResolvedValue(opts.membershipCount ?? 0) },
    careSeekerCaseAccess: {
      findUnique: jest.fn().mockResolvedValue(opts.existingAccess ?? null),
      create: jest.fn().mockResolvedValue({ id: "acc-1", relationship: "Daughter" }),
      update: jest.fn().mockResolvedValue({ id: "acc-1", relationship: "Daughter" }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    role: { findUnique: jest.fn().mockResolvedValue(opts.role === undefined ? { id: "role-seeker" } : opts.role) },
    $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
    careSeekerCaseAccess: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(grantedRow),
      // `in`, not `??`: a test that passes null is asking for "no such row",
      // which `??` would quietly turn back into the default.
      findFirst: jest
        .fn()
        .mockResolvedValue("accessRow" in opts ? opts.accessRow : { id: "acc-1", caseId: "case-a" }),
      findMany: jest.fn().mockResolvedValue([grantedRow]),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...grantedRow, ...data })),
    },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as PrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const supabase = {
    inviteByEmail: jest.fn().mockResolvedValue({ supabaseUserId: "sb-1" }),
    deleteAuthUser: jest.fn().mockResolvedValue(true),
  } as unknown as SupabaseService;
  const invitations = { send: jest.fn().mockResolvedValue("INVITE") } as unknown as InvitationService;
  const events = { record: jest.fn().mockResolvedValue(undefined) } as unknown as WorkflowEventsService;
  const svc = new CareSeekerAdminService(prisma, audit, supabase, invitations, events);
  return { svc, prisma, tx, audit, supabase, invitations, events };
}

const input = { caseId: "case-a", organizationId: "org-1", email: "Family@Example.com ", relationship: "Daughter" };

describe("CareSeekerAdminService.grant", () => {
  it("creates the application user and sends the same invitation email as an organization invite", async () => {
    const { svc, tx, invitations } = build();
    const view = await svc.grant(input, "staff-1");

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "family@example.com", status: "INVITED" }) }),
    );
    // Which email goes out, and where it points, is the invitation service's
    // own test — both workflows share it precisely so they cannot diverge.
    expect(invitations.send).toHaveBeenCalledWith("user-1", "family@example.com");
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
    const { svc, invitations } = build();
    (invitations.send as jest.Mock).mockRejectedValue(new InvitationEmailError("smtp down", false));
    await expect(svc.grant(input, "staff-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("tells the caller to wait when the send-rate limit was the problem", async () => {
    const { svc, invitations } = build();
    (invitations.send as jest.Mock).mockRejectedValue(
      new InvitationEmailError("429: email rate limit exceeded", true),
    );
    await expect(svc.grant(input, "staff-1")).rejects.toThrow(/rate limit/i);
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

// ---------------------------------------------------------------------------
// Resending and removing a pending family invitation
//
// Before these, a family invitation that never landed could only be chased by
// revoking the access and granting it again — rewriting the grant's history to
// work around a mail problem, and still failing once the address had been
// registered by the first attempt.
// ---------------------------------------------------------------------------

const pendingGrant = () => ({
    id: "acc-1",
    caseId: "case-a",
    userId: "user-1",
    status: "INVITED",
    user: {
      id: "user-1",
      email: "family@example.com",
      displayName: null,
      firstName: "Ann",
      lastName: "Miller",
      status: "INVITED",
      supabaseAuthUserId: "sb-1",
      _count: { memberships: 0, careSeekerAccess: 1 },
    },
  });

const target = { caseId: "case-a", organizationId: "org-1", accessId: "acc-1" };

describe("CareSeekerAdminService.resendInvitation", () => {
  it("sends the invitation again without touching the grant", async () => {
    const { svc, prisma, audit, invitations } = build({ accessRow: pendingGrant() });

    await expect(svc.resendInvitation(target, "staff-1")).resolves.toEqual({
      accessId: "acc-1",
      email: "family@example.com",
      emailKind: "INVITE",
    });

    expect(invitations.send).toHaveBeenCalledWith("user-1", "family@example.com");
    const update = (prisma as unknown as { careSeekerCaseAccess: { update: jest.Mock } }).careSeekerCaseAccess.update;
    expect(update).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "care_seeker.invitation_resent" }));
  });

  it("reports a password-setup link for an address already registered", async () => {
    const { svc, invitations } = build({ accessRow: pendingGrant() });
    (invitations.send as jest.Mock).mockResolvedValue("PASSWORD_SETUP");

    await expect(svc.resendInvitation(target, "staff-1")).resolves.toMatchObject({ emailKind: "PASSWORD_SETUP" });
  });

  it("refuses a revoked access, which needs restoring first", async () => {
    const grant = { ...pendingGrant(), status: "REVOKED" };
    const { svc, invitations } = build({ accessRow: grant });

    await expect(svc.resendInvitation(target, "staff-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(invitations.send).not.toHaveBeenCalled();
  });

  it("refuses someone who has already signed in", async () => {
    const grant = pendingGrant();
    const { svc, invitations } = build({
      accessRow: { ...grant, status: "ACTIVE", user: { ...grant.user, status: "ACTIVE" } },
    });

    await expect(svc.resendInvitation(target, "staff-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(invitations.send).not.toHaveBeenCalled();
  });

  it("404s for an access row on a different case", async () => {
    const { svc } = build({ accessRow: null });
    await expect(svc.resendInvitation(target, "staff-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CareSeekerAdminService.removeInvitation", () => {
  it("removes the grant, the account and the sign-in when the grant is all there is", async () => {
    // The point of the operation: the address must be free to invite again,
    // which an identity left behind would prevent.
    const { svc, tx, supabase, audit } = build({ accessRow: pendingGrant() });

    await expect(svc.removeInvitation(target, "staff-1")).resolves.toEqual({ id: "acc-1", accountRemoved: true });

    expect(supabase.deleteAuthUser).toHaveBeenCalledWith("sb-1");
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    // Deleting the user cascades the grant; deleting both would be wrong.
    expect(tx.careSeekerCaseAccess.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "care_seeker.invitation_removed" }),
      expect.anything(),
    );
  });

  it("keeps the account when the person is invited to another case as well", async () => {
    const grant = pendingGrant();
    const { svc, tx, supabase } = build({
      accessRow: { ...grant, user: { ...grant.user, _count: { memberships: 0, careSeekerAccess: 2 } } },
    });

    await expect(svc.removeInvitation(target, "staff-1")).resolves.toEqual({ id: "acc-1", accountRemoved: false });

    expect(tx.careSeekerCaseAccess.delete).toHaveBeenCalledWith({ where: { id: "acc-1" } });
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("refuses anything but a pending invitation, pointing at revoke", async () => {
    const grant = pendingGrant();
    const { svc, tx } = build({
      accessRow: { ...grant, status: "ACTIVE", user: { ...grant.user, status: "ACTIVE" } },
    });

    await expect(svc.removeInvitation(target, "staff-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.careSeekerCaseAccess.delete).not.toHaveBeenCalled();
  });

  it("leaves everything in place when the sign-in cannot be removed", async () => {
    const { svc, tx, supabase } = build({ accessRow: pendingGrant() });
    (supabase.deleteAuthUser as jest.Mock).mockRejectedValue(new Error("boom"));

    await expect(svc.removeInvitation(target, "staff-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("404s for an access row on a different case", async () => {
    const { svc } = build({ accessRow: null });
    await expect(svc.removeInvitation(target, "staff-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
