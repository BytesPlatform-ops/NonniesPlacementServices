import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { SuppressionsService } from "../suppressions/suppressions.service";
import { evaluateChannelEligibility } from "../eligibility";

export interface AudienceConfig {
  listIds: string[];
  contactIds: string[];
}

export interface EligibleContact {
  contactId: string;
  email: string;
  normalizedEmail: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
}

export interface AudienceExclusionCounts {
  NO_EMAIL: number;
  INVALID_EMAIL: number;
  CONSENT_UNKNOWN: number;
  OPTED_OUT: number;
  SUPPRESSED: number;
  CONTACT_ARCHIVED: number;
}

export interface AudienceEvaluation {
  totalUnique: number;
  duplicatesRemoved: number;
  eligible: EligibleContact[];
  eligibleCount: number;
  excludedCount: number;
  exclusions: AudienceExclusionCounts;
}

export interface EligibleSmsContact {
  contactId: string;
  phone: string;
  normalizedPhoneE164: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
}

export interface SmsAudienceExclusionCounts {
  NO_PHONE: number;
  INVALID_PHONE: number;
  CONSENT_UNKNOWN: number;
  OPTED_OUT: number;
  SUPPRESSED: number;
  CONTACT_ARCHIVED: number;
}

export interface SmsAudienceEvaluation {
  totalUnique: number;
  duplicatesRemoved: number;
  eligible: EligibleSmsContact[];
  eligibleCount: number;
  excludedCount: number;
  exclusions: SmsAudienceExclusionCounts;
}

const EMPTY_SMS_EXCLUSIONS = (): SmsAudienceExclusionCounts => ({ NO_PHONE: 0, INVALID_PHONE: 0, CONSENT_UNKNOWN: 0, OPTED_OUT: 0, SUPPRESSED: 0, CONTACT_ARCHIVED: 0 });

/** Defensive E.164 shape check for legacy/edge data already in the database. */
const E164 = /^\+[1-9]\d{6,14}$/;

const EMPTY_EXCLUSIONS = (): AudienceExclusionCounts => ({ NO_EMAIL: 0, INVALID_EMAIL: 0, CONSENT_UNKNOWN: 0, OPTED_OUT: 0, SUPPRESSED: 0, CONTACT_ARCHIVED: 0 });

@Injectable()
export class CampaignAudienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionsService,
  ) {}

  /** Union of contact ids from selected lists + explicitly selected contacts. */
  async resolveContactIds(audience: AudienceConfig): Promise<{ unique: string[]; rawCount: number }> {
    const fromLists = audience.listIds.length
      ? (await this.prisma.communicationListMember.findMany({ where: { listId: { in: audience.listIds } }, select: { contactId: true } })).map((m) => m.contactId)
      : [];
    const raw = [...fromLists, ...audience.contactIds];
    const unique = [...new Set(raw)];
    return { unique, rawCount: raw.length };
  }

  /**
   * Evaluate the audience for the EMAIL channel using the shared 15A policy:
   * OPTED_IN required, not suppressed, not archived, valid address. Deterministic
   * exclusion reasons; deduped union.
   */
  async evaluate(audience: AudienceConfig): Promise<AudienceEvaluation> {
    const { unique, rawCount } = await this.resolveContactIds(audience);
    const duplicatesRemoved = rawCount - unique.length;
    if (unique.length === 0) {
      return { totalUnique: 0, duplicatesRemoved, eligible: [], eligibleCount: 0, excludedCount: 0, exclusions: EMPTY_EXCLUSIONS() };
    }

    const contacts = await this.prisma.communicationContact.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        status: true,
        preferences: { where: { channel: "EMAIL" }, select: { consentStatus: true } },
      },
    });
    const emails = contacts.map((c) => c.normalizedEmail ?? "").filter(Boolean);
    const suppressed = await this.suppressions.flagsFor(emails, []);

    const exclusions = EMPTY_EXCLUSIONS();
    const eligible: EligibleContact[] = [];
    for (const c of contacts) {
      const hasAddress = !!c.normalizedEmail;
      const result = evaluateChannelEligibility({
        channel: "EMAIL",
        archived: c.status === "ARCHIVED",
        hasAddress,
        addressValid: hasAddress,
        consentStatus: c.preferences[0]?.consentStatus ?? "UNKNOWN",
        suppressed: hasAddress && suppressed.emails.has(c.normalizedEmail!),
      });
      if (result.eligible) {
        eligible.push({ contactId: c.id, email: c.email!, normalizedEmail: c.normalizedEmail!, firstName: c.firstName, lastName: c.lastName, organizationName: c.organizationName });
      } else {
        // Count the primary (first) reason for a clean summary.
        const reason = result.reasons[0] as keyof AudienceExclusionCounts;
        if (reason in exclusions) exclusions[reason] += 1;
      }
    }
    return {
      totalUnique: unique.length,
      duplicatesRemoved,
      eligible,
      eligibleCount: eligible.length,
      excludedCount: unique.length - eligible.length,
      exclusions,
    };
  }

  /**
   * Evaluate the audience for the SMS channel using the SAME shared 15A policy:
   * OPTED_IN required (UNKNOWN is never eligible), not suppressed, not archived,
   * valid E.164 number. Deterministic exclusion reasons; deduped union.
   */
  async evaluateSms(audience: AudienceConfig): Promise<SmsAudienceEvaluation> {
    const { unique, rawCount } = await this.resolveContactIds(audience);
    const duplicatesRemoved = rawCount - unique.length;
    if (unique.length === 0) {
      return { totalUnique: 0, duplicatesRemoved, eligible: [], eligibleCount: 0, excludedCount: 0, exclusions: EMPTY_SMS_EXCLUSIONS() };
    }

    const contacts = await this.prisma.communicationContact.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        phone: true,
        normalizedPhoneE164: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        status: true,
        preferences: { where: { channel: "SMS" }, select: { consentStatus: true } },
      },
    });
    const phones = contacts.map((c) => c.normalizedPhoneE164 ?? "").filter(Boolean);
    const suppressed = await this.suppressions.flagsFor([], phones);

    const exclusions = EMPTY_SMS_EXCLUSIONS();
    const eligible: EligibleSmsContact[] = [];
    for (const c of contacts) {
      const hasAddress = !!c.normalizedPhoneE164;
      const result = evaluateChannelEligibility({
        channel: "SMS",
        archived: c.status === "ARCHIVED",
        hasAddress,
        addressValid: hasAddress && E164.test(c.normalizedPhoneE164!),
        consentStatus: c.preferences[0]?.consentStatus ?? "UNKNOWN",
        suppressed: hasAddress && suppressed.phones.has(c.normalizedPhoneE164!),
      });
      if (result.eligible) {
        eligible.push({
          contactId: c.id,
          phone: c.phone ?? c.normalizedPhoneE164!,
          normalizedPhoneE164: c.normalizedPhoneE164!,
          firstName: c.firstName,
          lastName: c.lastName,
          organizationName: c.organizationName,
        });
      } else {
        const reason = result.reasons[0] as keyof SmsAudienceExclusionCounts;
        if (reason in exclusions) exclusions[reason] += 1;
      }
    }
    return {
      totalUnique: unique.length,
      duplicatesRemoved,
      eligible,
      eligibleCount: eligible.length,
      excludedCount: unique.length - eligible.length,
      exclusions,
    };
  }
}
