import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../database/prisma.service";
import { TagsService } from "./tags.service";

function build(tag: unknown) {
  const del = jest.fn().mockResolvedValue({});
  const prisma = {
    communicationTag: { findUnique: jest.fn().mockResolvedValue(tag), delete: del },
  } as unknown as PrismaService;
  return { svc: new TagsService(prisma), del };
}

describe("TagsService.remove", () => {
  it("deletes the tag and reports how many contacts it was removed from", async () => {
    const { svc, del } = build({ id: "t1", name: "VIP", _count: { assignments: 3 } });
    await expect(svc.remove("t1")).resolves.toEqual({ id: "t1", name: "VIP", removedAssignments: 3 });
    expect(del).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("reports zero for an unused tag", async () => {
    const { svc } = build({ id: "t2", name: "Typo", _count: { assignments: 0 } });
    await expect(svc.remove("t2")).resolves.toEqual({ id: "t2", name: "Typo", removedAssignments: 0 });
  });

  it("404s for a tag that does not exist, without attempting a delete", async () => {
    const { svc, del } = build(null);
    await expect(svc.remove("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});
