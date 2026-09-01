import type {
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
  contactName: string | null;
  contactEmail: string | null;
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
  organization: string | null;
  emailConsent: string | null;
  suppressed: boolean;
  lists: string[];
  tags: string[];
}

export interface ConversationDetail {
  id: string;
  contact: ContactContext;
  subject: string | null;
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
