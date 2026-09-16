import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { Prisma, type CommunicationConsentStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { toPhoneValue } from "../normalization";

/** Where a consent decision came from. Stored on the preference row for audit. */
export const CONSENT_SOURCE_ONBOARDING = "SEEKER_ONBOARDING";
export const CONSENT_SOURCE_PREFERENCES = "SEEKER_COMMUNICATION_PREFERENCES";

export interface SeekerCommunicationPreferences {
  /** Display form of the number on file, or null when none has been given. */
  phone: string | null;
  smsConsent: CommunicationConsentStatus;
  consentSource: string | null;
  consentAt: string | null;
  optOutAt: string | null;
  /** True while the person has neither given a number nor answered the SMS question. */
  setupRequired: boolean;
  /** True when SMS may actually be sent to them today. */
  smsEnabled: boolean;
}

interface SavePreferencesInput {
  phone: string;
  /** Explicit answer. Undefined means "not answered", which is never consent. */
  smsConsent?: boolean;
  source: string;
}

/**
 * Bridges a Discharge Professional's own account to the Communications contact
 * book, so that a person who agrees to SMS becomes reachable by the existing
 * campaign machinery without anyone re-typing them into the CRM.
 *
 * Three rules shape everything here:
 *
 *  1. A phone number is NOT consent. Entering a number and agreeing to SMS are
 *     separate decisions, and only the explicit answer moves consent.
 *  2. Consent is phone-specific. The stored preference describes permission to
 *     text ONE number, so changing the number resets consent to UNKNOWN and the
 *     person must opt in again — the alternative is texting a number its owner
 *     never agreed to hear from us on.
 *  3. The contact is the person, not a copy of them. The account link is unique,
 *     so repeated submissions and concurrent requests converge on one row rather
 *     than scattering duplicates through the CRM.
 *
 * Nothing here sends a message or touches the Twilio transport: it only decides
 * who the existing eligibility policy will later consider reachable.
 */
@Injectable()
export class UserContactService {
  private readonly logger = new Logger("SeekerContact");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Current phone + SMS consent for the signed-in person. */
  async preferences(user: RequestUser): Promise<SeekerCommunicationPreferences> {
    const contact = await this.prisma.communicationContact.findUnique({
      where: { userId: user.id },
      select: {
        phone: true,
        normalizedPhoneE164: true,
        preferences: { where: { channel: "SMS" }, select: { consentStatus: true, consentSource: true, consentAt: true, optOutAt: true } },
      },
    });
    const pref = contact?.preferences[0];
    return this.view(contact?.phone ?? null, !!contact?.normalizedPhoneE164, pref ?? null);
  }

  /**
   * Create or update the caller's own contact record and SMS consent.
   *
   * Idempotent: submitting the same thing twice converges on the same single
   * contact, the same single preference row, and no second audit entry for an
   * unchanged consent state.
   */
  async savePreferences(user: RequestUser, input: SavePreferencesInput): Promise<SeekerCommunicationPreferences> {
    const phone = toPhoneValue(input.phone, "US");
    if (!phone) throw new BadRequestException("Enter a valid mobile number, for example +1 415 555 0100.");

    const existing = await this.prisma.communicationContact.findUnique({
      where: { userId: user.id },
      select: { id: true, normalizedPhoneE164: true, preferences: { where: { channel: "SMS" }, select: { consentStatus: true } } },
    });

    // A number already claimed by a DIFFERENT contact cannot be taken over here:
    // silently moving it would hand one person another person's conversation
    // history and their consent record.
    const clash = await this.prisma.communicationContact.findFirst({
      where: { normalizedPhoneE164: phone.e164, ...(existing ? { id: { not: existing.id } } : {}) },
      select: { id: true, userId: true },
    });
    if (clash) {
      throw new ConflictException("That mobile number is already on file for someone else. Please check the number, or contact your care team.");
    }

    const numberChanged = !!existing?.normalizedPhoneE164 && existing.normalizedPhoneE164 !== phone.e164;
    const previous = existing?.preferences[0]?.consentStatus ?? "UNKNOWN";

    // Consent is phone-specific: a new number starts from UNKNOWN unless this
    // very request opts in for it.
    const next: CommunicationConsentStatus =
      input.smsConsent === true ? "OPTED_IN" : input.smsConsent === false ? "OPTED_OUT" : numberChanged ? "UNKNOWN" : previous;

    const account = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true, firstName: true, lastName: true } });
    const now = new Date();

    const contactId = await this.prisma.$transaction(async (tx) => {
      const id = existing?.id ?? (await this.claimContact(tx, user, account, phone, now));

      await tx.communicationContact.update({
        where: { id },
        data: {
          phone: phone.display,
          normalizedPhoneE164: phone.e164,
          firstName: account?.firstName ?? null,
          lastName: account?.lastName ?? null,
          updatedByUserId: user.id,
        },
      });

      await tx.contactChannelPreference.upsert({
        where: { contactId_channel: { contactId: id, channel: "SMS" } },
        create: {
          contactId: id,
          channel: "SMS",
          consentStatus: next,
          consentSource: next === "UNKNOWN" ? null : input.source,
          consentAt: next === "OPTED_IN" ? now : null,
          optOutAt: next === "OPTED_OUT" ? now : null,
          updatedByUserId: user.id,
        },
        update: {
          consentStatus: next,
          consentSource: next === "UNKNOWN" ? null : input.source,
          // Keep the original opt-in moment when nothing about consent changed.
          consentAt: next === "OPTED_IN" ? (previous === "OPTED_IN" ? undefined : now) : null,
          optOutAt: next === "OPTED_OUT" ? (previous === "OPTED_OUT" ? undefined : now) : null,
          updatedByUserId: user.id,
        },
      });

      return id;
    });

    if (numberChanged) {
      await this.audit.record({
        action: "communication.contact.phone_changed",
        entityType: "CommunicationContact",
        entityId: contactId,
        actorUserId: user.id,
        // Numbers themselves are not written to the audit trail.
        metadata: { channel: "SMS", consentReset: next === "UNKNOWN" },
      });
    }
    if (next !== previous) {
      await this.audit.record({
        action: "communication.consent.updated",
        entityType: "CommunicationContact",
        entityId: contactId,
        actorUserId: user.id,
        metadata: { channel: "SMS", previous, next, source: input.source },
      });
    }

    return this.preferences(user);
  }

  /**
   * Claim the contact row for this account.
   *
   * An email already in the book is adopted rather than duplicated — that record
   * is this person. Two concurrent first-time submissions race here, and the
   * unique account link is what settles it: the loser sees P2002 and re-reads
   * the winner's row instead of creating a second contact.
   */
  private async claimContact(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    account: { email: string; firstName: string | null; lastName: string | null } | null,
    phone: { display: string; e164: string },
    now: Date,
  ): Promise<string> {
    const normalizedEmail = account?.email?.trim().toLowerCase() ?? null;
    if (normalizedEmail) {
      const byEmail = await tx.communicationContact.findUnique({ where: { normalizedEmail }, select: { id: true, userId: true } });
      if (byEmail && !byEmail.userId) {
        await tx.communicationContact.update({ where: { id: byEmail.id }, data: { userId: user.id } });
        return byEmail.id;
      }
      if (byEmail?.userId === user.id) return byEmail.id;
    }

    try {
      const created = await tx.communicationContact.create({
        data: {
          userId: user.id,
          firstName: account?.firstName ?? null,
          lastName: account?.lastName ?? null,
          email: account?.email ?? null,
          normalizedEmail,
          phone: phone.display,
          normalizedPhoneE164: phone.e164,
          source: "SEEKER_ONBOARDING",
          createdByUserId: user.id,
          updatedByUserId: user.id,
          preferences: { create: [{ channel: "EMAIL" }, { channel: "SMS" }] },
        },
        select: { id: true },
      });
      await this.audit.record({
        action: "communication.contact.created",
        entityType: "CommunicationContact",
        entityId: created.id,
        actorUserId: user.id,
        metadata: { source: "SEEKER_ONBOARDING", createdAt: now.toISOString() },
      });
      return created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const won = await tx.communicationContact.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (won) return won.id;
      }
      throw err;
    }
  }

  private view(
    phone: string | null,
    hasPhone: boolean,
    pref: { consentStatus: CommunicationConsentStatus; consentSource: string | null; consentAt: Date | null; optOutAt: Date | null } | null,
  ): SeekerCommunicationPreferences {
    const smsConsent = pref?.consentStatus ?? "UNKNOWN";
    return {
      phone,
      smsConsent,
      consentSource: pref?.consentSource ?? null,
      consentAt: pref?.consentAt?.toISOString() ?? null,
      optOutAt: pref?.optOutAt?.toISOString() ?? null,
      // Only an unanswered question counts as setup outstanding; a deliberate
      // "no" is a completed decision and must not be nagged about.
      setupRequired: !hasPhone || smsConsent === "UNKNOWN",
      smsEnabled: hasPhone && smsConsent === "OPTED_IN",
    };
  }
}
