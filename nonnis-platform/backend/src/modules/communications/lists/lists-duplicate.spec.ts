import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import type { RequestUser } from "../../auth/request-user";
import { ListsService } from "./lists.service";
import { SYSTEM_AUDIENCE_KEYS } from "./system-audiences";

const USER = { id: "user-1" } as RequestUser;
const SOURCE = "11111111-1111-1111-1111-111111111111";

function build(source: { name: string; systemKey: string | null }, opts: { memberRows?: string[]; predicateRows?: string[] } = {}) {
  const created = { id: "new-list", name: "x", description: null, active: true, systemKey: null, createdAt: new Date(), updatedAt: new Date(), _count: { members: 0 } };
  const listCreate = jest.fn().mockResolvedValue(created);
  const memberCreateMany = jest.fn().mockResolvedValue({ count: (opts.memberRows ?? opts.predicateRows ?? []).length });
  const auditRecord = jest.fn().mockResolvedValue({});

  const tx = {
    communicationList: { create: listCreate },
    communicationListMember: { createMany: memberCreateMany },
  };
  const prisma = {
    communicationList: {
      findUnique: jest.fn().mockResolvedValue({ id: SOURCE, name: source.name, description: null, active: true, systemKey: source.systemKey, createdAt: new Date(), updatedAt: new Date(), _count: { members: (opts.memberRows ?? []).length } }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    communicationListMember: {
      findMany: jest.fn().mockResolvedValue((opts.memberRows ?? []).map((contactId) => ({ contactId }))),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    communicationContact: { findMany: jest.fn().mockResolvedValue((opts.predicateRows ?? []).map((id) => ({ id }))), count: jest.fn().mockResolvedValue(0) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const svc = new ListsService(prisma, { record: auditRecord } as unknown as AuditService, { flagsFor: jest.fn() } as unknown as SuppressionsService);
  return { svc, listCreate, memberCreateMany, auditRecord, prisma };
}

describe("ListsService.duplicate", () => {
  it("copies a curated list's members into a new list", async () => {
    const { svc, listCreate, memberCreateMany } = build({ name: "Nonni's Admins", systemKey: null }, { memberRows: ["c-1", "c-2"] });
    const out = await svc.duplicate(USER, SOURCE, {});

    expect(listCreate.mock.calls[0]![0].data.name).toBe("Nonni's Admins (copy)");
    expect(memberCreateMany.mock.calls[0]![0].data.map((d: { contactId: string }) => d.contactId)).toEqual(["c-1", "c-2"]);
    expect(out.memberCount).toBe(2);
  });

  it("materialises a derived audience by running its predicate", async () => {
    // The whole point of copying "SMS subscribers" is to get an editable
    // snapshot, so the copy must contain the people, not the rule.
    const { svc, memberCreateMany, prisma } = build({ name: "SMS subscribers", systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN }, { predicateRows: ["c-9", "c-10"] });
    await svc.duplicate(USER, SOURCE, {});

    expect(prisma.communicationContact.findMany).toHaveBeenCalledWith({
      where: { preferences: { some: { channel: "SMS", consentStatus: "OPTED_IN" } } },
      select: { id: true },
    });
    expect(memberCreateMany.mock.calls[0]![0].data.map((d: { contactId: string }) => d.contactId)).toEqual(["c-9", "c-10"]);
  });

  it("always produces a CURATED copy, never another derived audience", async () => {
    const { svc, listCreate } = build({ name: "SMS subscribers", systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN }, { predicateRows: ["c-9"] });
    const out = await svc.duplicate(USER, SOURCE, {});
    expect(listCreate.mock.calls[0]![0].data.systemKey).toBeUndefined();
    expect(out.systemKey).toBeNull();
  });

  it("honours a supplied name", async () => {
    const { svc, listCreate } = build({ name: "SMS subscribers", systemKey: null }, { memberRows: ["c-1"] });
    await svc.duplicate(USER, SOURCE, { name: "  Spring push only  " });
    expect(listCreate.mock.calls[0]![0].data.name).toBe("Spring push only");
  });

  it("never writes to the source list", async () => {
    const { svc, prisma } = build({ name: "Nonni's Admins", systemKey: null }, { memberRows: ["c-1"] });
    await svc.duplicate(USER, SOURCE, {});
    // The only list write is the create inside the transaction; nothing updates
    // or deletes on the original.
    expect((prisma.communicationList as unknown as { update?: unknown }).update).toBeUndefined();
    expect((prisma.communicationListMember as unknown as { deleteMany?: unknown }).deleteMany).toBeUndefined();
    // Members were read from the source, never written back to it.
    expect(prisma.communicationListMember.findMany).toHaveBeenCalledWith({ where: { listId: SOURCE }, select: { contactId: true } });
  });

  it("copies an empty list without attempting a member insert", async () => {
    const { svc, memberCreateMany } = build({ name: "Empty", systemKey: null }, { memberRows: [] });
    const out = await svc.duplicate(USER, SOURCE, {});
    expect(memberCreateMany).not.toHaveBeenCalled();
    expect(out.memberCount).toBe(0);
  });

  it("records who copied what", async () => {
    const { svc, auditRecord } = build({ name: "Nonni's Admins", systemKey: null }, { memberRows: ["c-1", "c-2"] });
    await svc.duplicate(USER, SOURCE, {});
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "communication.list.duplicated",
        actorUserId: "user-1",
        metadata: expect.objectContaining({ sourceListId: SOURCE, copied: 2 }),
      }),
    );
  });
});

describe("ListsService — derived audiences refuse hand editing", () => {
  it("rejects adding a member to a derived audience", async () => {
    const { svc } = build({ name: "SMS subscribers", systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN });
    await expect(svc.addMembers(USER, SOURCE, { contactIds: ["c-1"] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects removing a member from a derived audience", async () => {
    const { svc } = build({ name: "SMS subscribers", systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN });
    await expect(svc.removeMember(USER, SOURCE, "c-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("still allows editing an ordinary list", async () => {
    const { svc } = build({ name: "Nonni's Admins", systemKey: null }, { memberRows: [] });
    await expect(svc.addMembers(USER, SOURCE, { contactIds: ["c-1"] })).resolves.toBeDefined();
  });
});
