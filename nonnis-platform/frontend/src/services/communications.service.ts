import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  Channel,
  ConsentStatus,
  ContactCounts,
  ContactView,
  CsvInspectResult,
  ImportCommitResult,
  ImportPreviewResult,
  ImportRequest,
  ListView,
  SuppressionView,
  TagView,
} from "@/types/communications";

function qs(filters: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- Contacts ----

export type ContactFilters = Record<string, string | number | boolean | undefined>;

export function listContacts(filters: ContactFilters): Promise<PaginatedResult<ContactView>> {
  return apiGet(`/api/v1/communications/contacts${qs(filters)}`);
}
export function getContactCounts(): Promise<ContactCounts> {
  return apiGet(`/api/v1/communications/contacts/counts`);
}
export function getContact(id: string): Promise<ContactView> {
  return apiGet(`/api/v1/communications/contacts/${id}`);
}
export function createContact(body: Record<string, unknown>): Promise<ContactView> {
  return apiPost(`/api/v1/communications/contacts`, body);
}
export function updateContact(id: string, body: Record<string, unknown>): Promise<ContactView> {
  return apiPatch(`/api/v1/communications/contacts/${id}`, body);
}
export function setContactConsent(id: string, channel: Channel, consentStatus: ConsentStatus, consentSource?: string): Promise<ContactView> {
  return apiPost(`/api/v1/communications/contacts/${id}/consent`, { channel, consentStatus, consentSource });
}
export function archiveContact(id: string): Promise<ContactView> {
  return apiPost(`/api/v1/communications/contacts/${id}/archive`, {});
}

// ---- Lists ----

export function listLists(filters: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<ListView>> {
  return apiGet(`/api/v1/communications/lists${qs(filters)}`);
}
export function listOptions(): Promise<Array<{ id: string; name: string }>> {
  return apiGet(`/api/v1/communications/lists/options`);
}
export function getList(id: string): Promise<ListView> {
  return apiGet(`/api/v1/communications/lists/${id}`);
}
export function listMembers(id: string, filters: Record<string, string | number | undefined>): Promise<PaginatedResult<ContactView>> {
  return apiGet(`/api/v1/communications/lists/${id}/members${qs(filters)}`);
}
export function createList(body: { name: string; description?: string }): Promise<ListView> {
  return apiPost(`/api/v1/communications/lists`, body);
}
export function updateList(id: string, body: Record<string, unknown>): Promise<ListView> {
  return apiPatch(`/api/v1/communications/lists/${id}`, body);
}
export function addListMembers(id: string, contactIds: string[]): Promise<{ added: number }> {
  return apiPost(`/api/v1/communications/lists/${id}/members`, { contactIds });
}
export function removeListMember(id: string, contactId: string): Promise<{ removed: boolean }> {
  return apiDelete(`/api/v1/communications/lists/${id}/members/${contactId}`);
}

// ---- Tags ----

export function listTags(): Promise<TagView[]> {
  return apiGet(`/api/v1/communications/tags`);
}
export function assignTag(contactId: string, name: string): Promise<{ id: string; name: string }> {
  return apiPost(`/api/v1/communications/tags/assign`, { contactId, name });
}
export function unassignTag(contactId: string, tagId: string): Promise<{ removed: boolean }> {
  return apiPost(`/api/v1/communications/tags/unassign`, { contactId, tagId });
}

// ---- Suppressions ----

export function listSuppressions(filters: Record<string, string | number | undefined>): Promise<PaginatedResult<SuppressionView>> {
  return apiGet(`/api/v1/communications/suppressions${qs(filters)}`);
}
export function createSuppression(body: { channel: Channel; address: string; reason: string; source?: string }): Promise<SuppressionView> {
  return apiPost(`/api/v1/communications/suppressions`, body);
}
export function removeSuppression(id: string): Promise<SuppressionView> {
  return apiDelete(`/api/v1/communications/suppressions/${id}`);
}

// ---- Imports ----

export function inspectCsv(content: string): Promise<CsvInspectResult> {
  return apiPost(`/api/v1/communications/imports/csv-inspect`, { content });
}
export function previewImport(body: ImportRequest): Promise<ImportPreviewResult> {
  return apiPost(`/api/v1/communications/imports/preview`, body);
}
export function commitImport(body: ImportRequest): Promise<ImportCommitResult> {
  return apiPost(`/api/v1/communications/imports/commit`, body);
}
