import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CommunicationChannel } from "@prisma/client";
import type { CountryCode } from "libphonenumber-js";
import { PrismaService } from "../../../database/prisma.service";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { SuppressionsService } from "../suppressions/suppressions.service";
import { isSupportedCountry, toEmailValue, toPhoneValue, type EmailValue, type PhoneValue } from "../normalization";
import { contactDetailInclude, toContactView, type ContactView } from "../communications.serializer";
import type { CreateContactDto, ListContactsDto, SetConsentDto, UpdateContactDto } from "../dto/contacts.dto";

export interface ContactCounts {
  totalActive: number;
  emailContacts: number;
  smsContacts: number;
  suppressed: number;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly suppressions: SuppressionsService,
  ) {}

  private country(dto: { defaultCountry?: string }): CountryCode {
    return dto.defaultCountry && isSupportedCountry(dto.defaultCountry) ? dto.defaultCountry : "US";
  }

  /** Validate + normalize the channels; requires at least one usable channel. */
  private resolveChannels(dto: CreateContactDto): { email: EmailValue | null; phone: PhoneValue | null } {
    let email: EmailValue | null = null;
    let phone: PhoneValue | null = null;
    if (dto.email && dto.email.trim()) {
      email = toEmailValue(dto.email);
      if (!email) throw new BadRequestException("Invalid email format.");
    }
    if (dto.phone && dto.phone.trim()) {
      phone = toPhoneValue(dto.phone, this.country(dto));
      if (!phone) throw new BadRequestException("Invalid phone number.");
    }
    if (!email && !phone) throw new BadRequestException("Provide at least a valid email or phone.");
    return { email, phone };
  }

  async counts(): Promise<ContactCounts> {
    const [totalActive, emailContacts, smsContacts, suppressed] = await this.prisma.$transaction([
      this.prisma.communicationContact.count({ where: { status: "ACTIVE" } }),
      this.prisma.communicationContact.count({ where: { status: "ACTIVE", normalizedEmail: { not: null } } }),
      this.prisma.communicationContact.count({ where: { status: "ACTIVE", normalizedPhoneE164: { not: null } } }),
      this.prisma.communicationSuppression.count({ where: { active: true } }),
    ]);
    return { totalActive, emailContacts, smsContacts, suppressed };
  }

  async list(query: ListContactsDto): Promise<PaginatedResult<ContactView>> {
    const and: Prisma.CommunicationContactWhereInput[] = [];
    and.push({ status: query.status ?? "ACTIVE" });
    if (query.hasEmail !== undefined) and.push({ normalizedEmail: query.hasEmail ? { not: null } : null });
    if (query.hasPhone !== undefined) and.push({ normalizedPhoneE164: query.hasPhone ? { not: null } : null });
    if (query.emailConsent) and.push({ preferences: { some: { channel: "EMAIL", consentStatus: query.emailConsent } } });
    if (query.smsConsent) and.push({ preferences: { some: { channel: "SMS", consentStatus: query.smsConsent } } });
    if (query.listId) and.push({ listMemberships: { some: { listId: query.listId } } });
    if (query.tagId) and.push({ tagAssignments: { some: { tagId: query.tagId } } });
    if (query.search) {
      const s = query.search.trim();
      and.push({
        OR: [
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
          { organizationName: { contains: s, mode: "insensitive" } },
        ],
      });
    }
    if (query.suppressed) {
      // Bounded suppression filter (foundation-scale): match against active addresses.
      const rows = await this.prisma.communicationSuppression.findMany({
        where: { active: true, channel: query.suppressed },
        select: { normalizedAddress: true },
        take: 10_000,
      });
      const addresses = rows.map((r) => r.normalizedAddress);
      and.push(query.suppressed === "EMAIL" ? { normalizedEmail: { in: addresses } } : { normalizedPhoneE164: { in: addresses } });
    }

    const where: Prisma.CommunicationContactWhereInput = { AND: and };
    const sortField = query.sort && ["updatedAt", "createdAt", "organizationName"].includes(query.sort) ? query.sort : "updatedAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationContact.findMany({
        where,
        include: contactDetailInclude,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.communicationContact.count({ where }),
    ]);

    const flags = await this.suppressions.flagsFor(
      rows.map((r) => r.normalizedEmail ?? "").filter(Boolean),
      rows.map((r) => r.normalizedPhoneE164 ?? "").filter(Boolean),
    );
    return {
      items: rows.map((r) =>
        toContactView(r, {
          email: !!r.normalizedEmail && flags.emails.has(r.normalizedEmail),
          sms: !!r.normalizedPhoneE164 && flags.phones.has(r.normalizedPhoneE164),
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string): Promise<ContactView> {
    const row = await this.prisma.communicationContact.findUnique({ where: { id }, include: contactDetailInclude });
    if (!row) throw new NotFoundException("Contact not found");
    const flags = await this.suppressions.flagsFor(
      row.normalizedEmail ? [row.normalizedEmail] : [],
      row.normalizedPhoneE164 ? [row.normalizedPhoneE164] : [],
    );
    return toContactView(row, {
      email: !!row.normalizedEmail && flags.emails.has(row.normalizedEmail),
      sms: !!row.normalizedPhoneE164 && flags.phones.has(row.normalizedPhoneE164),
    });
  }

  async create(user: RequestUser, dto: CreateContactDto): Promise<ContactView> {
    const { email, phone } = this.resolveChannels(dto);
    await this.assertNoConflict(email?.normalized ?? null, phone?.e164 ?? null, null);

    try {
      const created = await this.prisma.communicationContact.create({
        data: {
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          email: email?.display ?? null,
          normalizedEmail: email?.normalized ?? null,
          phone: phone?.display ?? null,
          normalizedPhoneE164: phone?.e164 ?? null,
          organizationName: dto.organizationName?.trim() || null,
          source: "MANUAL",
          createdByUserId: user.id,
          updatedByUserId: user.id,
          preferences: {
            create: [
              ...(email ? [{ channel: "EMAIL" as CommunicationChannel }] : []),
              ...(phone ? [{ channel: "SMS" as CommunicationChannel }] : []),
            ],
          },
        },
      });
      await this.audit.record({
        action: "communication.contact.created",
        entityType: "CommunicationContact",
        entityId: created.id,
        actorUserId: user.id,
      });
      return this.findOne(created.id);
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  async update(user: RequestUser, id: string, dto: UpdateContactDto): Promise<ContactView> {
    const existing = await this.prisma.communicationContact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found");

    // Only re-validate channels the caller actually provided.
    let email: EmailValue | null | undefined;
    let phone: PhoneValue | null | undefined;
    if (dto.email !== undefined) {
      email = dto.email.trim() ? toEmailValue(dto.email) : null;
      if (dto.email.trim() && !email) throw new BadRequestException("Invalid email format.");
    }
    if (dto.phone !== undefined) {
      phone = dto.phone.trim() ? toPhoneValue(dto.phone, this.country(dto)) : null;
      if (dto.phone.trim() && !phone) throw new BadRequestException("Invalid phone number.");
    }

    const nextEmail = email === undefined ? existing.normalizedEmail : (email?.normalized ?? null);
    const nextPhone = phone === undefined ? existing.normalizedPhoneE164 : (phone?.e164 ?? null);
    if (!nextEmail && !nextPhone) throw new BadRequestException("A contact must keep at least an email or phone.");
    await this.assertNoConflict(email !== undefined ? nextEmail : null, phone !== undefined ? nextPhone : null, id);

    try {
      await this.prisma.communicationContact.update({
        where: { id },
        data: {
          firstName: dto.firstName !== undefined ? dto.firstName.trim() || null : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName.trim() || null : undefined,
          organizationName: dto.organizationName !== undefined ? dto.organizationName.trim() || null : undefined,
          email: email === undefined ? undefined : (email?.display ?? null),
          normalizedEmail: email === undefined ? undefined : (email?.normalized ?? null),
          phone: phone === undefined ? undefined : (phone?.display ?? null),
          normalizedPhoneE164: phone === undefined ? undefined : (phone?.e164 ?? null),
          updatedByUserId: user.id,
        },
      });
    } catch (err) {
      throw this.mapUniqueError(err);
    }
    await this.audit.record({
      action: "communication.contact.updated",
      entityType: "CommunicationContact",
      entityId: id,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.findOne(id);
  }

  async archive(user: RequestUser, id: string): Promise<ContactView> {
    const existing = await this.prisma.communicationContact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found");
    await this.prisma.communicationContact.update({ where: { id }, data: { status: "ARCHIVED", updatedByUserId: user.id } });
    await this.audit.record({
      action: "communication.contact.archived",
      entityType: "CommunicationContact",
      entityId: id,
      actorUserId: user.id,
    });
    return this.findOne(id);
  }

  async setConsent(user: RequestUser, id: string, dto: SetConsentDto): Promise<ContactView> {
    const existing = await this.prisma.communicationContact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found");
    const now = new Date();
    await this.prisma.contactChannelPreference.upsert({
      where: { contactId_channel: { contactId: id, channel: dto.channel } },
      create: {
        contactId: id,
        channel: dto.channel,
        consentStatus: dto.consentStatus,
        consentSource: dto.consentSource ?? null,
        consentAt: dto.consentStatus === "OPTED_IN" ? now : null,
        optOutAt: dto.consentStatus === "OPTED_OUT" ? now : null,
        updatedByUserId: user.id,
      },
      update: {
        consentStatus: dto.consentStatus,
        consentSource: dto.consentSource ?? null,
        consentAt: dto.consentStatus === "OPTED_IN" ? now : null,
        optOutAt: dto.consentStatus === "OPTED_OUT" ? now : null,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({
      action: "communication.consent.updated",
      entityType: "CommunicationContact",
      entityId: id,
      actorUserId: user.id,
      metadata: { channel: dto.channel, consentStatus: dto.consentStatus },
    });
    return this.findOne(id);
  }

  /** Reject an update/create that would collide with, or conflict across, existing contacts. */
  private async assertNoConflict(normalizedEmail: string | null, normalizedPhoneE164: string | null, selfId: string | null): Promise<void> {
    if (!normalizedEmail && !normalizedPhoneE164) return;
    const matches = await this.prisma.communicationContact.findMany({
      where: {
        OR: [
          ...(normalizedEmail ? [{ normalizedEmail }] : []),
          ...(normalizedPhoneE164 ? [{ normalizedPhoneE164 }] : []),
        ],
        ...(selfId ? { id: { not: selfId } } : {}),
      },
      select: { id: true, normalizedEmail: true, normalizedPhoneE164: true },
    });
    if (matches.length === 0) return;
    const emailOwner = normalizedEmail ? matches.find((m) => m.normalizedEmail === normalizedEmail)?.id : undefined;
    const phoneOwner = normalizedPhoneE164 ? matches.find((m) => m.normalizedPhoneE164 === normalizedPhoneE164)?.id : undefined;
    if (emailOwner && phoneOwner && emailOwner !== phoneOwner) {
      throw new ConflictException("This email and phone belong to two different existing contacts. Resolve the conflict manually.");
    }
    throw new ConflictException("A contact with this email or phone already exists.");
  }

  private mapUniqueError(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException("A contact with this email or phone already exists.");
    }
    return err instanceof Error ? err : new Error("Unexpected error");
  }
}
