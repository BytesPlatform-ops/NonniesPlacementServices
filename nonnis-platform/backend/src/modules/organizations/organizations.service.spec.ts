import { NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";

function orgRow(id = "org-1") {
  const now = new Date();
  return {
    id,
    type: "HOSPITAL",
    status: "ACTIVE",
    name: "General Hospital",
    legalName: null,
    externalRef: null,
    createdAt: now,
    updatedAt: now,
    _count: { facilities: 2, memberships: 3 },
  };
}

function platformAdmin(): RequestUser {
  return {
    id: "admin",
    supabaseUserId: "s",
    email: "a@x.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    activeOrganizationId: "nonnis",
    activePermissions: new Set([PERMISSIONS.ORGANIZATIONS_MANAGE, PERMISSIONS.ORGANIZATIONS_READ]),
  };
}

function orgScopedUser(orgId: string): RequestUser {
  return {
    id: "u",
    supabaseUserId: "s",
    email: "u@x.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [
      {
        membershipId: "m",
        organizationId: orgId,
        organizationName: "Provider",
        organizationType: "PROVIDER",
        organizationStatus: "ACTIVE",
        roleId: "r",
        roleCode: "PROVIDER_STAFF",
        roleName: "Provider Staff",
        isPrimary: true,
        permissions: [PERMISSIONS.ORGANIZATIONS_READ],
      },
    ],
    activeOrganizationId: orgId,
    activePermissions: new Set([PERMISSIONS.ORGANIZATIONS_READ]),
  };
}

describe("OrganizationsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates an organization and writes an audit event", async () => {
    const audit = { record: jest.fn() } as unknown as AuditService;
    const prisma = {
      organization: { create: jest.fn().mockResolvedValue(orgRow("new-org")) },
    } as unknown as PrismaService;
    const svc = new OrganizationsService(prisma, audit);

    const result = await svc.create(platformAdmin(), { type: "HOSPITAL", name: "General Hospital" } as never);
    expect(result.id).toBe("new-org");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.created" }));
  });

  it("hides an organization a non-member cannot access (404)", async () => {
    const audit = { record: jest.fn() } as unknown as AuditService;
    const prisma = { organization: { findUnique: jest.fn().mockResolvedValue(orgRow()) } } as unknown as PrismaService;
    const svc = new OrganizationsService(prisma, audit);

    // org-scoped user is a member of "other-org", requests "org-1"
    await expect(svc.findOne(orgScopedUser("other-org"), "org-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows a platform admin to read any organization", async () => {
    const audit = { record: jest.fn() } as unknown as AuditService;
    const prisma = { organization: { findUnique: jest.fn().mockResolvedValue(orgRow("org-1")) } } as unknown as PrismaService;
    const svc = new OrganizationsService(prisma, audit);

    const result = await svc.findOne(platformAdmin(), "org-1");
    expect(result.id).toBe("org-1");
  });

  it("records an audit event when status changes", async () => {
    const audit = { record: jest.fn() } as unknown as AuditService;
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: "org-1" }),
        update: jest.fn().mockResolvedValue(orgRow("org-1")),
      },
    } as unknown as PrismaService;
    const svc = new OrganizationsService(prisma, audit);

    await svc.setStatus(platformAdmin(), "org-1", "INACTIVE");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.status_changed" }));
  });
});
