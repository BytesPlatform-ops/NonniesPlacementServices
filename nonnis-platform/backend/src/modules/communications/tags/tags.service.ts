import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { RequestUser } from "../../auth/request-user";

export interface TagView {
  id: string;
  name: string;
  contactCount: number;
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TagView[]> {
    const rows = await this.prisma.communicationTag.findMany({ include: { _count: { select: { assignments: true } } }, orderBy: { name: "asc" } });
    return rows.map((r) => ({ id: r.id, name: r.name, contactCount: r._count.assignments }));
  }

  private clean(name: string): string {
    return name.trim();
  }

  /** Find-or-create a tag by name (idempotent). */
  async ensureByName(name: string): Promise<{ id: string; name: string }> {
    const clean = this.clean(name);
    return this.prisma.communicationTag.upsert({ where: { name: clean }, create: { name: clean }, update: {}, select: { id: true, name: true } });
  }

  async ensureByNames(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const clean = this.clean(name);
      if (!clean) continue;
      const tag = await this.ensureByName(clean);
      ids.push(tag.id);
    }
    return ids;
  }

  async create(name: string): Promise<TagView> {
    const tag = await this.ensureByName(name);
    return { ...tag, contactCount: 0 };
  }

  /**
   * Delete a tag. Assignments are removed with it (the join row cascades on the
   * tag relation), so the tag disappears from every contact it was applied to.
   * Contacts themselves are never touched. The removed-assignment count is
   * returned so the caller can tell the user what the delete actually affected.
   */
  async remove(id: string): Promise<{ id: string; name: string; removedAssignments: number }> {
    const tag = await this.prisma.communicationTag.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { assignments: true } } },
    });
    if (!tag) throw new NotFoundException("Tag not found");
    await this.prisma.communicationTag.delete({ where: { id } });
    return { id: tag.id, name: tag.name, removedAssignments: tag._count.assignments };
  }

  async assign(_user: RequestUser, contactId: string, name: string): Promise<{ id: string; name: string }> {
    const contact = await this.prisma.communicationContact.findUnique({ where: { id: contactId }, select: { id: true } });
    if (!contact) throw new NotFoundException("Contact not found");
    const tag = await this.ensureByName(name);
    await this.prisma.communicationContactTag.upsert({
      where: { contactId_tagId: { contactId, tagId: tag.id } },
      create: { contactId, tagId: tag.id },
      update: {},
    });
    return tag;
  }

  async unassign(_user: RequestUser, contactId: string, tagId: string): Promise<{ removed: boolean }> {
    await this.prisma.communicationContactTag.deleteMany({ where: { contactId, tagId } });
    return { removed: true };
  }

  /** Attach many tags to many contacts (used by import). Safe against duplicates. */
  async assignManyToContacts(contactIds: string[], tagIds: string[]): Promise<void> {
    if (contactIds.length === 0 || tagIds.length === 0) return;
    const data = contactIds.flatMap((contactId) => tagIds.map((tagId) => ({ contactId, tagId })));
    await this.prisma.communicationContactTag.createMany({ data, skipDuplicates: true });
  }
}
