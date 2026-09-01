import type {
  CommunicationEmailCampaign,
  CommunicationEmailCampaignRecipient,
  CommunicationEmailCampaignStatus,
  CommunicationEmailRecipientStatus,
  CommunicationEmailTemplate,
  CommunicationEmailTemplateStatus,
} from "@prisma/client";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export interface EmailTemplateSummary {
  id: string;
  name: string;
  status: CommunicationEmailTemplateStatus;
  subjectDefault: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
  description: string | null;
  preheaderDefault: string | null;
  designJson: unknown;
  createdAt: string;
}

export function toTemplateSummary(t: CommunicationEmailTemplate, names: Map<string, string | null>): EmailTemplateSummary {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    subjectDefault: t.subjectDefault,
    updatedAt: t.updatedAt.toISOString(),
    updatedByName: t.updatedByUserId ? (names.get(t.updatedByUserId) ?? null) : null,
  };
}

export function toTemplateDetail(t: CommunicationEmailTemplate, names: Map<string, string | null>): EmailTemplateDetail {
  return {
    ...toTemplateSummary(t, names),
    description: t.description,
    preheaderDefault: t.preheaderDefault,
    designJson: t.designJson,
    createdAt: t.createdAt.toISOString(),
  };
}

export interface CampaignRecipientCounts {
  total: number;
  excluded: number;
  queued: number;
  processing: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
  cancelled: number;
  deliveryUnknown: number;
}

export interface EmailCampaignSummary {
  id: string;
  name: string;
  status: CommunicationEmailCampaignStatus;
  subject: string | null;
  eligibleRecipientCount: number;
  excludedRecipientCount: number;
  createdAt: string;
  queuedAt: string | null;
}

export interface EmailCampaignDetail extends EmailCampaignSummary {
  templateId: string | null;
  preheader: string | null;
  senderEmail: string | null;
  senderName: string | null;
  htmlSnapshot: string | null;
  audienceConfig: unknown;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  counts?: CampaignRecipientCounts;
}

export function toCampaignSummary(c: CommunicationEmailCampaign): EmailCampaignSummary {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    subject: c.subjectSnapshot,
    eligibleRecipientCount: c.eligibleRecipientCount,
    excludedRecipientCount: c.excludedRecipientCount,
    createdAt: c.createdAt.toISOString(),
    queuedAt: iso(c.queuedAt),
  };
}

export function toCampaignDetail(c: CommunicationEmailCampaign, counts?: CampaignRecipientCounts): EmailCampaignDetail {
  return {
    ...toCampaignSummary(c),
    templateId: c.templateId,
    preheader: c.preheaderSnapshot,
    senderEmail: c.senderEmail,
    senderName: c.senderName,
    htmlSnapshot: c.htmlSnapshot,
    audienceConfig: c.audienceConfig,
    startedAt: iso(c.startedAt),
    completedAt: iso(c.completedAt),
    cancelledAt: iso(c.cancelledAt),
    updatedAt: c.updatedAt.toISOString(),
    counts,
  };
}

export interface EmailRecipientView {
  id: string;
  contactId: string;
  email: string;
  name: string | null;
  organization: string | null;
  deliveryStatus: CommunicationEmailRecipientStatus;
  exclusionReason: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

export function toRecipientView(r: CommunicationEmailCampaignRecipient): EmailRecipientView {
  return {
    id: r.id,
    contactId: r.contactId,
    email: r.emailSnapshot,
    name: [r.firstNameSnapshot, r.lastNameSnapshot].filter(Boolean).join(" ") || null,
    organization: r.organizationNameSnapshot,
    deliveryStatus: r.deliveryStatus,
    exclusionReason: r.exclusionReason,
    errorMessage: r.lastErrorMessageSafe,
    sentAt: iso(r.sentAt),
    deliveredAt: iso(r.deliveredAt),
    updatedAt: r.updatedAt.toISOString(),
  };
}
