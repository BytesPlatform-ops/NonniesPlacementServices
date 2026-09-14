import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationAudienceService } from "./notification-audience.service";
import { NOTIFICATION_DEFINITIONS, NOTIFICATION_TYPES, eventKey } from "./notification-catalog";
import type { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";

function actor(id: string): RequestUser {
  return {
    id,
    supabaseUserId: `sb-${id}`,
    email: `${id}@example.com`,
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    caseAccess: [],
    activeOrganizationId: null,
    activePermissions: new Set([PERMISSIONS.NOTIFICATIONS_READ]),
  };
}

function harness(over: Record<string, unknown> = {}) {
  const notificationCreate = jest.fn().mockResolvedValue({ id: "notif-1" });
  const recipientCreateMany = jest.fn().mockResolvedValue({ count: 2 });
  const recipientUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

  const prisma: Record<string, unknown> = {
    notification: { create: notificationCreate, findUnique: jest.fn().mockResolvedValue(null) },
    notificationRecipient: {
      createMany: recipientCreateMany,
      updateMany: recipientUpdateMany,
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirstOrThrow: jest.fn(),
    },
    organizationMembership: { findMany: jest.fn().mockResolvedValue([]) },
    careSeekerCaseAccess: { findMany: jest.fn().mockResolvedValue([]) },
    provider: { findUnique: jest.fn().mockResolvedValue({ organizationId: "org-a" }) },
    case: { findUnique: jest.fn().mockResolvedValue(null) },
    ...over,
  };
  prisma.$transaction = jest
    .fn()
    .mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(prisma),
    );
  const typed = prisma as unknown as PrismaService;
  const audience = new NotificationAudienceService(typed);
  return { prisma, audience, svc: new NotificationsService(typed, audience), notificationCreate, recipientCreateMany, recipientUpdateMany };
}

const base = {
  type: NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED,
  title: "New marketplace request",
  message: "A family asked to rent a room.",
};

describe("NotificationsService — raising", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes one payload and one recipient row per person", async () => {
    const h = harness();
    await h.svc.raise({ ...base, recipientUserIds: ["u1", "u2"], eventKey: "k1" });

    expect(h.notificationCreate).toHaveBeenCalledTimes(1);
    const rows = h.recipientCreateMany.mock.calls[0][0];
    expect(rows.data).toEqual([
      { notificationId: "notif-1", recipientUserId: "u1" },
      { notificationId: "notif-1", recipientUserId: "u2" },
    ]);
    // A person reachable by two audiences is still notified once.
    expect(rows.skipDuplicates).toBe(true);
  });

  it("takes its priority from the event, never from the caller", async () => {
    const h = harness();
    await h.svc.raise({ ...base, recipientUserIds: ["u1"] });
    expect(h.notificationCreate.mock.calls[0][0].data.priority).toBe(
      NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED].priority,
    );
    expect(h.notificationCreate.mock.calls[0][0].data.priority).toBe("HIGH");
  });

  it("never notifies the person who caused the event", async () => {
    const h = harness();
    await h.svc.raise({ ...base, recipientUserIds: ["u1", "actor-1"], actorUserId: "actor-1" });
    expect(h.recipientCreateMany.mock.calls[0][0].data).toEqual([{ notificationId: "notif-1", recipientUserId: "u1" }]);
  });

  it("does nothing at all when the audience is empty", async () => {
    const h = harness();
    await expect(h.svc.raise({ ...base, recipientUserIds: [] })).resolves.toBeNull();
    expect(h.notificationCreate).not.toHaveBeenCalled();
  });

  it("collapses a replayed event instead of notifying twice", async () => {
    // The whole point of eventKey: one acceptance processed twice is one
    // notification, not two.
    const h = harness({ notification: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue({ id: "existing" }) } });
    const result = await h.svc.raise({ ...base, recipientUserIds: ["u1"], eventKey: "marketplace_order.accepted:o1" });

    expect(result).toEqual({ notificationId: "existing", delivered: 0 });
    expect(h.recipientCreateMany).not.toHaveBeenCalled();
  });

  it("keeps genuinely different events apart via the discriminator", () => {
    const a = eventKey(NOTIFICATION_TYPES.REFERRAL_RESPONDED, "ref-1", "ACCEPT");
    const b = eventKey(NOTIFICATION_TYPES.REFERRAL_RESPONDED, "ref-1", "INFORMATION");
    expect(a).not.toBe(b);
    expect(eventKey(NOTIFICATION_TYPES.REFERRAL_RESPONDED, "ref-1")).toBe("referral.responded:ref-1");
  });

  it("never lets a notification failure break the action that caused it", async () => {
    // A provider accepted an order; a write problem here must not undo that.
    const h = harness({ notification: { create: jest.fn().mockRejectedValue(new Error("db down")), findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(h.svc.raise({ ...base, recipientUserIds: ["u1"] })).resolves.toBeNull();
  });
});

describe("NotificationsService — reading own feed only", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes every list to the caller", async () => {
    const h = harness();
    await h.svc.list(actor("me"), { page: 1, pageSize: 20 });
    const where = (h.prisma.notificationRecipient as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where.recipientUserId).toBe("me");
  });

  it("filters unread in the database, not in the browser", async () => {
    const h = harness();
    await h.svc.list(actor("me"), { page: 1, pageSize: 20, filter: "unread" });
    const where = (h.prisma.notificationRecipient as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    // Accurate across pagination precisely because the rows never exist.
    expect(where).toMatchObject({ recipientUserId: "me", readAt: null });
  });

  it("filters read in the database too", async () => {
    const h = harness();
    await h.svc.list(actor("me"), { page: 1, pageSize: 20, filter: "read" });
    const where = (h.prisma.notificationRecipient as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where.readAt).toEqual({ not: null });
  });

  it("counts only the caller's unread rows", async () => {
    const h = harness();
    await h.svc.unreadCount(actor("me"));
    expect((h.prisma.notificationRecipient as { count: jest.Mock }).count.mock.calls[0][0].where).toEqual({
      recipientUserId: "me",
      readAt: null,
    });
  });
});

describe("NotificationsService — read state", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marks read only a row that belongs to the caller", async () => {
    const h = harness();
    (h.prisma.notificationRecipient as { findFirstOrThrow: jest.Mock }).findFirstOrThrow.mockResolvedValue({
      id: "r1",
      readAt: new Date(),
      createdAt: new Date(),
      notification: { type: NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED, priority: "HIGH", title: "t", message: "m", route: "/x", entityType: "MarketplaceOrder", entityId: "o1" },
    });
    await h.svc.setRead(actor("me"), "r1", true);

    const where = h.recipientUpdateMany.mock.calls[0][0].where;
    // Ownership is part of the write, so another person's id matches nothing.
    expect(where).toEqual({ id: "r1", recipientUserId: "me" });
  });

  it("404s when the row is someone else's", async () => {
    const h = harness();
    h.recipientUpdateMany.mockResolvedValue({ count: 0 });
    await expect(h.svc.setRead(actor("intruder"), "r1", true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("can put a notification back to unread", async () => {
    const h = harness();
    (h.prisma.notificationRecipient as { findFirstOrThrow: jest.Mock }).findFirstOrThrow.mockResolvedValue({
      id: "r1",
      readAt: null,
      createdAt: new Date(),
      notification: { type: NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED, priority: "HIGH", title: "t", message: "m", route: null, entityType: null, entityId: null },
    });
    const view = await h.svc.setRead(actor("me"), "r1", false);
    expect(h.recipientUpdateMany.mock.calls[0][0].data).toEqual({ readAt: null });
    expect(view.read).toBe(false);
  });

  it("marks all read for the caller and nobody else", async () => {
    const h = harness();
    h.recipientUpdateMany.mockResolvedValue({ count: 7 });
    await expect(h.svc.markAllRead(actor("me"))).resolves.toEqual({ count: 7 });
    expect(h.recipientUpdateMany.mock.calls[0][0].where).toEqual({ recipientUserId: "me", readAt: null });
  });
});

describe("NotificationAudienceService — who may be told", () => {
  beforeEach(() => jest.clearAllMocks());

  it("selects organization members by the permission the event requires", async () => {
    const h = harness();
    await h.audience.organizationUsers("org-a", PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN);
    const where = (h.prisma.organizationMembership as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      organizationId: "org-a",
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      role: { permissions: { some: { permission: { code: "marketplace_orders.manage_own" } } } },
    });
  });

  it("binds a provider audience to that provider's own organization", async () => {
    // This is what keeps Provider A out of Provider B's feed.
    const h = harness();
    await h.audience.providerUsers("provider-a", PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN);
    expect((h.prisma.organizationMembership as { findMany: jest.Mock }).findMany.mock.calls[0][0].where.organizationId).toBe("org-a");
  });

  it("returns nobody when the provider has no organization", async () => {
    const h = harness({ provider: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(h.audience.providerUsers("ghost", PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)).resolves.toEqual([]);
    expect((h.prisma.organizationMembership as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it("includes only live family grants on a live case", async () => {
    const h = harness();
    await h.audience.caseFamilyUsers("case-1");
    const where = (h.prisma.careSeekerCaseAccess as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    // A revoked relative stops being notified for the same reason they stop
    // being able to open the case.
    expect(where).toMatchObject({
      caseId: "case-1",
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      case: { status: { not: "CANCELLED" } },
    });
  });

  it("adds the assigned professional to a case team", async () => {
    const h = harness({
      case: { findUnique: jest.fn().mockResolvedValue({ organizationId: "org-h", assignedDischargeProfessionalId: "dp-1" }) },
      organizationMembership: { findMany: jest.fn().mockResolvedValue([{ userId: "staff-1" }]) },
    });
    await expect(h.audience.caseTeamUsers("case-1", PERMISSIONS.REFERRALS_READ)).resolves.toEqual(["staff-1", "dp-1"]);
  });

  it("returns nobody for a case that does not exist", async () => {
    const h = harness();
    await expect(h.audience.caseTeamUsers("missing", PERMISSIONS.REFERRALS_READ)).resolves.toEqual([]);
  });

  it("restricts the platform audience to active Nonnis organizations", async () => {
    const h = harness();
    await h.audience.platformUsers(PERMISSIONS.MARKETPLACE_ADMIN_READ);
    const where = (h.prisma.organizationMembership as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where.organization).toEqual({ type: "NONNIS", status: "ACTIVE" });
  });
});

describe("notification catalog", () => {
  it("gives every type a priority and a source", () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      const definition = NOTIFICATION_DEFINITIONS[type];
      expect(definition).toBeDefined();
      expect(["LOW", "NORMAL", "HIGH", "CRITICAL"]).toContain(definition.priority);
      expect(definition.source).toBeTruthy();
    }
  });

  it("reserves CRITICAL for system failure rather than routine work", () => {
    // Business events top out at HIGH so CRITICAL still means something when
    // it is eventually used.
    const priorities = Object.values(NOTIFICATION_DEFINITIONS).map((d) => d.priority);
    expect(priorities).not.toContain("CRITICAL");
  });

  it("marks work that is waiting on someone as HIGH", () => {
    expect(NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED].priority).toBe("HIGH");
    expect(NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.REFERRAL_RECEIVED].priority).toBe("HIGH");
    expect(NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.TASK_ASSIGNED].priority).toBe("HIGH");
    expect(NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.DOCUMENT_REQUESTED].priority).toBe("HIGH");
  });

  it("keeps a finished order informational", () => {
    expect(NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.MARKETPLACE_ORDER_COMPLETED].priority).toBe("LOW");
  });
});
