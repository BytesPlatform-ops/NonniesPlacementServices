import { Prisma, type CommunicationChannel, type CommunicationConsentStatus, type CommunicationContactSource, type CommunicationContactStatus } from "@prisma/client";

export const contactDetailInclude = {
  preferences: true,
  listMemberships: { include: { list: { select: { id: true, name: true } } } },
  tagAssignments: { include: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.CommunicationContactInclude;

export type ContactRow = Prisma.CommunicationContactGetPayload<{ include: typeof contactDetailInclude }>;

export interface ContactView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organizationName: string | null;
  source: CommunicationContactSource;
  status: CommunicationContactStatus;
  hasEmail: boolean;
  hasPhone: boolean;
  emailConsent: CommunicationConsentStatus;
  smsConsent: CommunicationConsentStatus;
  emailConsentSource: string | null;
  smsConsentSource: string | null;
  emailSuppressed: boolean;
  smsSuppressed: boolean;
  lists: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSuppressionFlags {
  email: boolean;
  sms: boolean;
}

function consentFor(row: ContactRow, channel: CommunicationChannel): { status: CommunicationConsentStatus; source: string | null } {
  const pref = row.preferences.find((p) => p.channel === channel);
  return { status: pref?.consentStatus ?? "UNKNOWN", source: pref?.consentSource ?? null };
}

export function toContactView(row: ContactRow, suppressed: ContactSuppressionFlags): ContactView {
  const email = consentFor(row, "EMAIL");
  const sms = consentFor(row, "SMS");
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    organizationName: row.organizationName,
    source: row.source,
    status: row.status,
    hasEmail: !!row.normalizedEmail,
    hasPhone: !!row.normalizedPhoneE164,
    emailConsent: email.status,
    smsConsent: sms.status,
    emailConsentSource: email.source,
    smsConsentSource: sms.source,
    emailSuppressed: suppressed.email,
    smsSuppressed: suppressed.sms,
    lists: row.listMemberships.map((m) => ({ id: m.list.id, name: m.list.name })),
    tags: row.tagAssignments.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
