export type ConsentStatus = "UNKNOWN" | "OPTED_IN" | "OPTED_OUT";
export type ContactStatus = "ACTIVE" | "ARCHIVED";
export type Channel = "EMAIL" | "SMS";
export type SuppressionReason = "USER_OPT_OUT" | "ADMIN_BLOCK" | "HARD_BOUNCE" | "SPAM_COMPLAINT" | "INVALID_ADDRESS";

export interface ContactView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organizationName: string | null;
  source: string;
  status: ContactStatus;
  hasEmail: boolean;
  hasPhone: boolean;
  emailConsent: ConsentStatus;
  smsConsent: ConsentStatus;
  emailConsentSource: string | null;
  smsConsentSource: string | null;
  emailSuppressed: boolean;
  smsSuppressed: boolean;
  lists: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactCounts {
  totalActive: number;
  emailContacts: number;
  smsContacts: number;
  suppressed: number;
}

export interface ListView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagView {
  id: string;
  name: string;
  contactCount: number;
}

export interface SuppressionView {
  id: string;
  channel: Channel;
  address: string;
  reason: string;
  active: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ImportSourceType = "PASTE" | "CSV" | "TXT";
export type ImportRowStatus = "NEW" | "DUPLICATE" | "INVALID" | "CONFLICT" | "SUPPRESSED";

export interface ImportRowResult {
  row: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  status: ImportRowStatus;
  issue: string | null;
}

export interface ImportCounts {
  total: number;
  new: number;
  duplicate: number;
  invalid: number;
  conflict: number;
  suppressed: number;
}

export interface ImportPreviewResult {
  sourceType: string;
  counts: ImportCounts;
  sampleRows: ImportRowResult[];
  problemRows: ImportRowResult[];
  truncated: boolean;
}

export interface ImportCommitResult extends ImportCounts {
  batchId: string;
  importedCount: number;
  listId: string | null;
  tagIds: string[];
}

export interface CsvInspectResult {
  headers: string[];
  sampleRows: string[][];
}

export interface CsvMapping {
  firstName?: number;
  lastName?: number;
  email?: number;
  phone?: number;
  organization?: number;
}

export interface ImportRequest {
  sourceType: ImportSourceType;
  mode?: "EMAIL" | "PHONE";
  content: string;
  defaultCountry?: string;
  mapping?: CsvMapping;
  updateEmptyOnly?: boolean;
  listId?: string;
  newListName?: string;
  tagNames?: string[];
  originalFilename?: string;
}
