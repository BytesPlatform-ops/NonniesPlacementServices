import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  AudienceEvaluation,
  EmailCampaignDetail,
  EmailCampaignSummary,
  EmailDesign,
  EmailRecipientView,
  EmailStatus,
  EmailTemplateDetail,
  EmailTemplateSummary,
} from "@/types/communications-email";

function qs(f: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- Status ----
export function getEmailStatus(): Promise<EmailStatus> {
  return apiGet(`/api/v1/communications/email/status`);
}

// ---- Templates ----
export function listTemplates(f: Record<string, string | number | undefined>): Promise<PaginatedResult<EmailTemplateSummary>> {
  return apiGet(`/api/v1/communications/email/templates${qs(f)}`);
}
export function getTemplate(id: string): Promise<EmailTemplateDetail> {
  return apiGet(`/api/v1/communications/email/templates/${id}`);
}
export function createTemplate(body: { name: string; description?: string; subjectDefault?: string; preheaderDefault?: string; designJson: EmailDesign }): Promise<EmailTemplateDetail> {
  return apiPost(`/api/v1/communications/email/templates`, body);
}
export function updateTemplate(id: string, body: Record<string, unknown>): Promise<EmailTemplateDetail> {
  return apiPatch(`/api/v1/communications/email/templates/${id}`, body);
}
export function duplicateTemplate(id: string): Promise<EmailTemplateDetail> {
  return apiPost(`/api/v1/communications/email/templates/${id}/duplicate`, {});
}
export function archiveTemplate(id: string): Promise<EmailTemplateDetail> {
  return apiPost(`/api/v1/communications/email/templates/${id}/archive`, {});
}
export function previewTemplate(body: { designJson: EmailDesign; preheader?: string; sampleValues?: Record<string, string> }): Promise<{ html: string; text: string }> {
  return apiPost(`/api/v1/communications/email/templates/preview`, body);
}
export function testSendTemplate(id: string, body: { toEmail: string; subject?: string; sampleValues?: Record<string, string> }): Promise<{ ok: boolean; mock: boolean; providerMessageId?: string; message: string }> {
  return apiPost(`/api/v1/communications/email/templates/${id}/test-send`, body);
}

// ---- Campaigns ----
export function listCampaigns(f: Record<string, string | number | undefined>): Promise<PaginatedResult<EmailCampaignSummary>> {
  return apiGet(`/api/v1/communications/email/campaigns${qs(f)}`);
}
export function getCampaign(id: string): Promise<EmailCampaignDetail> {
  return apiGet(`/api/v1/communications/email/campaigns/${id}`);
}
export function createCampaign(body: Record<string, unknown>): Promise<EmailCampaignDetail> {
  return apiPost(`/api/v1/communications/email/campaigns`, body);
}
export function updateCampaign(id: string, body: Record<string, unknown>): Promise<EmailCampaignDetail> {
  return apiPatch(`/api/v1/communications/email/campaigns/${id}`, body);
}
export function audiencePreview(audience: { listIds?: string[]; contactIds?: string[] }): Promise<AudienceEvaluation> {
  return apiPost(`/api/v1/communications/email/campaigns/audience-preview`, { audience });
}
export function queueCampaign(id: string): Promise<EmailCampaignDetail> {
  return apiPost(`/api/v1/communications/email/campaigns/${id}/queue`, {});
}
export function cancelCampaign(id: string): Promise<EmailCampaignDetail> {
  return apiPost(`/api/v1/communications/email/campaigns/${id}/cancel`, {});
}
export function listRecipients(id: string, f: Record<string, string | number | undefined>): Promise<PaginatedResult<EmailRecipientView>> {
  return apiGet(`/api/v1/communications/email/campaigns/${id}/recipients${qs(f)}`);
}
