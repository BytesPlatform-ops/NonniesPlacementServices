export type InboxView = "all" | "unread" | "needs_reply" | "archived";
export type CommunicationChannel = "EMAIL" | "SMS";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type ConversationStatus = "OPEN" | "CLOSED" | "ARCHIVED";
export type MessageStatus = "QUEUED" | "PROCESSING" | "ACCEPTED" | "SENT" | "DELIVERED" | "UNDELIVERED" | "BOUNCED" | "FAILED" | "DELIVERY_UNKNOWN" | "RECEIVED";
export type ReviewReason =
  | "NO_TOKEN"
  | "UNKNOWN_TOKEN"
  | "MALFORMED_ADDRESS"
  | "THREAD_SENDER_MISMATCH"
  | "HEADER_SENDER_MISMATCH"
  | "UNRESOLVED"
  | "UNKNOWN_PHONE"
  | "PHONE_CONFLICT"
  | "UNKNOWN_BUSINESS_NUMBER"
  | "INVALID_PROVIDER_PAYLOAD";
export type ReviewStatus = "PENDING" | "LINKED" | "DISMISSED";

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
  latestDirection: MessageDirection | null;
  lastMessageAt: string | null;
  status: ConversationStatus;
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

export interface MessageView {
  id: string;
  direction: MessageDirection;
  status: MessageStatus;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  preview: string | null;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  autoSubmitted: boolean;
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
  businessNumber: string | null;
  status: ConversationStatus;
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
  reason: ReviewReason;
  status: ReviewStatus;
  receivedAt: string | null;
  createdAt: string;
}

export interface ReplyAttachmentRef {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface InboundStatus {
  provider: string;
  mockMode: boolean;
  configured: boolean;
  sendingLiveButInboundMissing: boolean;
}
