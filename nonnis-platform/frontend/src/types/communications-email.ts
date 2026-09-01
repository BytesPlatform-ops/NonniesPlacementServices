export type Align = "left" | "center" | "right";

export type SimpleBlock =
  | { id: string; type: "text"; content: string; align: Align }
  | { id: string; type: "heading"; content: string; level: 1 | 2 | 3; align: Align }
  | { id: string; type: "image"; src: string; alt: string; align: Align; widthPct: number; href?: string }
  | { id: string; type: "button"; label: string; href: string; align: Align; backgroundColor: string; textColor: string; radius: number }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number };

export type Block = SimpleBlock | { id: string; type: "columns"; columns: SimpleBlock[][] };

export interface EmailDesignSettings {
  backgroundColor: string;
  contentBackgroundColor: string;
  contentWidth: number;
  textColor: string;
  linkColor: string;
  fontFamily: string;
}

export interface EmailDesign {
  version: number;
  settings: EmailDesignSettings;
  blocks: Block[];
}

export const MERGE_FIELDS = ["firstName", "lastName", "fullName", "email", "organizationName"] as const;
export const EMAIL_FONTS = [
  "Arial, Helvetica, sans-serif",
  "Helvetica, Arial, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Trebuchet MS', Tahoma, sans-serif",
  "Tahoma, Verdana, sans-serif",
  "Verdana, Geneva, sans-serif",
];

export type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface EmailTemplateSummary {
  id: string;
  name: string;
  status: TemplateStatus;
  subjectDefault: string | null;
  updatedAt: string;
  updatedByName: string | null;
}
export interface EmailTemplateDetail extends EmailTemplateSummary {
  description: string | null;
  preheaderDefault: string | null;
  designJson: EmailDesign;
  createdAt: string;
}

export type CampaignStatus = "DRAFT" | "READY" | "QUEUED" | "SENDING" | "COMPLETED" | "PARTIALLY_FAILED" | "CANCELLED";
export type RecipientStatus = "EXCLUDED" | "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" | "UNSUBSCRIBED" | "CANCELLED" | "DELIVERY_UNKNOWN";

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
  status: CampaignStatus;
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
  audienceConfig: { listIds?: string[]; contactIds?: string[] };
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  counts?: CampaignRecipientCounts;
}

export interface EmailRecipientView {
  id: string;
  contactId: string;
  email: string;
  name: string | null;
  organization: string | null;
  deliveryStatus: RecipientStatus;
  exclusionReason: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

export interface AudienceEvaluation {
  totalUnique: number;
  duplicatesRemoved: number;
  eligibleCount: number;
  excludedCount: number;
  exclusions: {
    NO_EMAIL: number;
    INVALID_EMAIL: number;
    CONSENT_UNKNOWN: number;
    OPTED_OUT: number;
    SUPPRESSED: number;
    CONTACT_ARCHIVED: number;
  };
}

export interface EmailProviderStatus {
  provider: string;
  configured: boolean;
  mockMode: boolean;
  senderEmail: string;
  senderName: string;
}
export interface EmailStatus {
  provider: EmailProviderStatus;
  dispatch: { provider: string; enabled: boolean; queued: number; processing: number; failed: number; deliveryUnknown: number };
}
