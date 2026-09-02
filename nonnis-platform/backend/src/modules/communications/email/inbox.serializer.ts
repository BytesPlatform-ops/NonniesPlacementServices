import type {
  CommunicationChannel,
  CommunicationConversation,
  CommunicationConversationStatus,
  CommunicationInboundEmailReview,
  CommunicationInboundReviewReason,
  CommunicationInboundReviewStatus,
  CommunicationMessage,
  CommunicationMessageAttachment,
  CommunicationMessageDirection,
  CommunicationMessageStatus,
} from "@prisma/client";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export interface ConversationListItem {
  id: string;
  contactId: string;
  channel: CommunicationChannel;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactOrganization: string | null;
  subject: string | null;
  preview: string | null;
  latestDirection: CommunicationMessageDirection | null;
  lastMessageAt: string | null;
  status: CommunicationConversationStatus;
  unread: boolean;
  needsReply: boolean;
  originCampaignId: string | null;
  originCampaignName: string | null;
}

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function toAttachmentView(a: CommunicationMessageAttachment): AttachmentView {
  return { id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes };
}

export interface MessageView {
  id: string;
  direction: CommunicationMessageDirection;
  status: CommunicationMessageStatus;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  preview: string | null;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  autoSubmitted: boolean;
  /** Provider-classified SMS keyword (STOP/START/HELP) — never a staff-reply task. */
  smsOptOutType: string | null;
  encoding: string | null;
  segmentCount: number | null;
  errorMessage: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  attachments: AttachmentView[];
}

export function toMessageView(m: CommunicationMessage & { attachments?: CommunicationMessageAttachment[] }): MessageView {
  return {
    id: m.id,
    direction: m.direction,
    status: m.status,
    subject: m.subject,
    textBody: m.textBody,
    htmlBody: m.htmlBody,
    preview: m.previewText,
    fromAddress: m.fromAddress,
    fromName: m.fromName,
    toAddress: m.toAddress,
    autoSubmitted: m.autoSubmitted,
    smsOptOutType: m.smsOptOutType,
    encoding: m.encoding,
    segmentCount: m.segmentCount,
    errorMessage: m.lastErrorMessageSafe,
    sentAt: iso(m.sentAt),
    receivedAt: iso(m.receivedAt),
    deliveredAt: iso(m.deliveredAt),
    createdAt: m.createdAt.toISOString(),
    attachments: (m.attachments ?? []).map(toAttachmentView),
  };
}

export interface ContactContext {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  emailConsent: string | null;
  smsConsent: string | null;
  suppressed: boolean;
  smsSuppressed: boolean;
  lists: string[];
  tags: string[];
}

export interface ConversationDetail {
  id: string;
  channel: CommunicationChannel;
  contact: ContactContext;
  subject: string | null;
  /** The Nonnis/Twilio business number backing an SMS conversation. */
  businessNumber: string | null;
  status: CommunicationConversationStatus;
  needsReply: boolean;
  replyAddress: string | null;
  originCampaignId: string | null;
  originCampaignName: string | null;
  createdAt: string;
  messages: MessageView[];
}

export interface InboundReviewView {
  id: string;
  provider: string;
  channel: CommunicationChannel;
  /** Email address, or E.164 phone number for an SMS review item. */
  fromEmail: string;
  fromName: string | null;
  toAddress: string | null;
  subject: string | null;
  preview: string | null;
  textBody: string | null;
  htmlBody: string | null;
  reason: CommunicationInboundReviewReason;
  status: CommunicationInboundReviewStatus;
  receivedAt: string | null;
  createdAt: string;
}

export function toInboundReviewView(r: CommunicationInboundEmailReview): InboundReviewView {
  return {
    id: r.id,
    provider: r.provider,
    channel: r.channel,
    fromEmail: r.fromEmail,
    fromName: r.fromName,
    toAddress: r.toAddress,
    subject: r.subject,
    preview: r.previewText,
    textBody: r.textBody,
    htmlBody: r.sanitizedHtmlBody,
    reason: r.reason,
    status: r.status,
    receivedAt: iso(r.receivedAt),
    createdAt: r.createdAt.toISOString(),
  };
}

/** needsReply is derived, never persisted: newest human inbound with no later outbound. */
export function deriveNeedsReply(c: Pick<CommunicationConversation, "lastInboundAt" | "lastOutboundAt" | "status">): boolean {
  if (c.status === "ARCHIVED") return false;
  if (!c.lastInboundAt) return false;
  return !c.lastOutboundAt || c.lastInboundAt.getTime() > c.lastOutboundAt.getTime();
}
