import type {
  CommunicationSmsCampaign,
  CommunicationSmsCampaignRecipient,
  CommunicationSmsCampaignStatus,
  CommunicationSmsRecipientStatus,
  CommunicationSmsTemplate,
  CommunicationSmsTemplateStatus,
  SmsEncoding,
} from "@prisma/client";
import type { SegmentInfo } from "./sms-segments";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export interface SmsTemplateSummary {
  id: string;
  name: string;
  status: CommunicationSmsTemplateStatus;
  updatedAt: string;
  /** Estimate computed from sample merge values — never an invoice. */
  segments: SegmentInfo;
}

export interface SmsTemplateDetail extends SmsTemplateSummary {
  description: string | null;
  body: string;
  createdAt: string;
}

export function toSmsTemplateSummary(t: CommunicationSmsTemplate, segments: SegmentInfo): SmsTemplateSummary {
  return { id: t.id, name: t.name, status: t.status, updatedAt: t.updatedAt.toISOString(), segments };
}

export function toSmsTemplateDetail(t: CommunicationSmsTemplate, segments: SegmentInfo): SmsTemplateDetail {
  return { ...toSmsTemplateSummary(t, segments), description: t.description, body: t.body, createdAt: t.createdAt.toISOString() };
}

export interface SmsRecipientCounts {
  total: number;
  excluded: number;
  queued: number;
  processing: number;
  accepted: number;
  sent: number;
  delivered: number;
  undelivered: number;
  failed: number;
  cancelled: number;
  deliveryUnknown: number;
}

export interface SmsCampaignSummary {
  id: string;
  name: string;
  status: CommunicationSmsCampaignStatus;
  eligibleRecipientCount: number;
  excludedRecipientCount: number;
  estimatedSegmentCount: number;
  createdAt: string;
  queuedAt: string | null;
}

export interface SmsCampaignDetail extends SmsCampaignSummary {
  templateId: string | null;
  bodySnapshot: string | null;
  audienceConfig: unknown;
  gsm7RecipientCount: number;
  ucs2RecipientCount: number;
  multiSegmentCount: number;
  longestBodyChars: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  counts?: SmsRecipientCounts;
}

export function toSmsCampaignSummary(c: CommunicationSmsCampaign): SmsCampaignSummary {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    eligibleRecipientCount: c.eligibleRecipientCount,
    excludedRecipientCount: c.excludedRecipientCount,
    estimatedSegmentCount: c.estimatedSegmentCount,
    createdAt: c.createdAt.toISOString(),
    queuedAt: iso(c.queuedAt),
  };
}

export function toSmsCampaignDetail(c: CommunicationSmsCampaign, counts?: SmsRecipientCounts): SmsCampaignDetail {
  return {
    ...toSmsCampaignSummary(c),
    templateId: c.templateId,
    bodySnapshot: c.bodySnapshot,
    audienceConfig: c.audienceConfig,
    gsm7RecipientCount: c.gsm7RecipientCount,
    ucs2RecipientCount: c.ucs2RecipientCount,
    multiSegmentCount: c.multiSegmentCount,
    longestBodyChars: c.longestBodyChars,
    startedAt: iso(c.startedAt),
    completedAt: iso(c.completedAt),
    cancelledAt: iso(c.cancelledAt),
    updatedAt: c.updatedAt.toISOString(),
    counts,
  };
}

export interface SmsRecipientView {
  id: string;
  contactId: string;
  phone: string;
  name: string | null;
  organization: string | null;
  deliveryStatus: CommunicationSmsRecipientStatus;
  encoding: SmsEncoding;
  estimatedSegmentCount: number;
  providerSegmentCount: number | null;
  exclusionReason: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

/** Never exposes claim tokens, provider ids, or the rendered body. */
export function toSmsRecipientView(r: CommunicationSmsCampaignRecipient): SmsRecipientView {
  return {
    id: r.id,
    contactId: r.contactId,
    phone: r.phoneSnapshot,
    name: [r.firstNameSnapshot, r.lastNameSnapshot].filter(Boolean).join(" ") || null,
    organization: r.organizationNameSnapshot,
    deliveryStatus: r.deliveryStatus,
    encoding: r.encodingSnapshot,
    estimatedSegmentCount: r.estimatedSegmentCount,
    providerSegmentCount: r.providerSegmentCount,
    exclusionReason: r.exclusionReason,
    errorMessage: r.lastErrorMessageSafe,
    sentAt: iso(r.sentAt),
    deliveredAt: iso(r.deliveredAt),
    updatedAt: r.updatedAt.toISOString(),
  };
}
