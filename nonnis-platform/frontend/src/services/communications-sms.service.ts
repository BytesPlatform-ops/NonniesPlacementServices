import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  SmsAudiencePreview,
  SmsCampaignDetail,
  SmsCampaignSummary,
  SmsPreview,
  SmsRecipientView,
  SmsStatus,
  SmsTemplateDetail,
  SmsTemplateSummary,
  SmsTestResult,
} from "@/types/communications-sms";

const BASE = "/api/v1/communications/sms";

function qs(f: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface Audience {
  listIds?: string[];
  contactIds?: string[];
}

// ---- Status ----
export function getSmsStatus(): Promise<SmsStatus> {
  return apiGet(`${BASE}/status`);
}

// ---- Templates ----
export function listSmsTemplates(f: Record<string, string | number | undefined>): Promise<PaginatedResult<SmsTemplateSummary>> {
  return apiGet(`${BASE}/templates${qs(f)}`);
}
export function getSmsTemplate(id: string): Promise<SmsTemplateDetail> {
  return apiGet(`${BASE}/templates/${id}`);
}
export function createSmsTemplate(body: { name: string; description?: string; body: string }): Promise<SmsTemplateDetail> {
  return apiPost(`${BASE}/templates`, body);
}
export function updateSmsTemplate(id: string, body: Partial<{ name: string; description: string; body: string; status: string }>): Promise<SmsTemplateDetail> {
  return apiPatch(`${BASE}/templates/${id}`, body);
}
export function archiveSmsTemplate(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/templates/${id}/archive`);
}
/** Server-authoritative preview (rendered body + segments) for unsaved content. */
export function previewSms(body: string): Promise<SmsPreview> {
  return apiPost(`${BASE}/templates/preview`, { body });
}
export function testSms(id: string, phone: string, body?: string): Promise<SmsTestResult> {
  return apiPost(`${BASE}/templates/${id}/test`, { phone, body });
}

// ---- Campaigns ----
export function listSmsCampaigns(f: Record<string, string | number | undefined>): Promise<PaginatedResult<SmsCampaignSummary>> {
  return apiGet(`${BASE}/campaigns${qs(f)}`);
}
export function getSmsCampaign(id: string): Promise<SmsCampaignDetail> {
  return apiGet(`${BASE}/campaigns/${id}`);
}
export function createSmsCampaign(body: { name: string; templateId?: string; body?: string; audience?: Audience }): Promise<SmsCampaignDetail> {
  return apiPost(`${BASE}/campaigns`, body);
}
export function smsAudiencePreview(audience: Audience, templateId?: string, body?: string): Promise<SmsAudiencePreview> {
  return apiPost(`${BASE}/campaigns/audience-preview`, { audience, templateId, body });
}
export function queueSmsCampaign(id: string): Promise<SmsCampaignDetail> {
  return apiPost(`${BASE}/campaigns/${id}/queue`);
}
export function cancelSmsCampaign(id: string): Promise<SmsCampaignDetail> {
  return apiPost(`${BASE}/campaigns/${id}/cancel`);
}
export function listSmsRecipients(id: string, f: Record<string, string | number | undefined>): Promise<PaginatedResult<SmsRecipientView>> {
  return apiGet(`${BASE}/campaigns/${id}/recipients${qs(f)}`);
}
