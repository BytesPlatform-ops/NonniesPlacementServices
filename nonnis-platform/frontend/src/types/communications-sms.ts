import type { SegmentInfo } from "@/lib/sms-segments";

export type SmsTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type SmsCampaignStatus = "DRAFT" | "READY" | "QUEUED" | "SENDING" | "COMPLETED" | "PARTIALLY_FAILED" | "CANCELLED";
export type SmsRecipientStatus =
  | "EXCLUDED"
  | "QUEUED"
  | "PROCESSING"
  | "ACCEPTED"
  | "SENT"
  | "DELIVERED"
  | "UNDELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "DELIVERY_UNKNOWN";

export interface SmsTemplateSummary {
  id: string;
  name: string;
  status: SmsTemplateStatus;
  updatedAt: string;
  segments: SegmentInfo;
}

export interface SmsTemplateDetail extends SmsTemplateSummary {
  description: string | null;
  body: string;
  createdAt: string;
}

export interface SmsPreview {
  renderedBody: string;
  segments: SegmentInfo;
}

export interface SmsTestResult {
  ok: boolean;
  mock: boolean;
  message: string;
  segments: SegmentInfo;
  renderedBody: string;
}

export interface SmsSegmentSummary {
  estimatedSegmentCount: number;
  gsm7RecipientCount: number;
  ucs2RecipientCount: number;
  multiSegmentCount: number;
  longestBodyChars: number;
}

export interface SmsAudienceExclusions {
  NO_PHONE: number;
  INVALID_PHONE: number;
  CONSENT_UNKNOWN: number;
  OPTED_OUT: number;
  SUPPRESSED: number;
  CONTACT_ARCHIVED: number;
}

export interface SmsAudiencePreview {
  totalUnique: number;
  duplicatesRemoved: number;
  eligibleCount: number;
  excludedCount: number;
  exclusions: SmsAudienceExclusions;
  summary: SmsSegmentSummary;
  sampleBody: string | null;
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
  status: SmsCampaignStatus;
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

export interface SmsRecipientView {
  id: string;
  contactId: string;
  phone: string;
  name: string | null;
  organization: string | null;
  deliveryStatus: SmsRecipientStatus;
  encoding: "GSM7" | "UCS2";
  estimatedSegmentCount: number;
  providerSegmentCount: number | null;
  exclusionReason: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

/** Safe, secret-free provider status for the settings banner. */
export interface SmsStatus {
  provider: string;
  mockMode: boolean;
  configured: boolean;
  configurationError: string | null;
  messagingServiceConfigured: boolean;
  sendingNumber: string | null;
  a2pApproved: boolean;
  webhooksConfigured: boolean;
  campaignSendingAllowed: boolean;
  campaignBlockedReason: string | null;
  directReplyAllowed: boolean;
  directReplyBlockedReason: string | null;
  inboundAdapter: string;
  inboundVerifiable: boolean;
}
