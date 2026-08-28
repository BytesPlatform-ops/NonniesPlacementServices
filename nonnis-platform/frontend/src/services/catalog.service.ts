import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { ReferenceItemView, ServiceCategoryView } from "@/types/catalog";

interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  activeOnly?: boolean;
}

function qs(params: ListParams): string {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.q) query.set("q", params.q);
  if (params.activeOnly) query.set("activeOnly", "true");
  const s = query.toString();
  return s ? `?${s}` : "";
}

// ---- Service categories ----

export function listServiceCategories(params: ListParams = {}): Promise<PaginatedResult<ServiceCategoryView>> {
  return apiGet<PaginatedResult<ServiceCategoryView>>(`/api/v1/service-categories${qs(params)}`);
}

export function createServiceCategory(body: {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<ServiceCategoryView> {
  return apiPost<ServiceCategoryView>("/api/v1/service-categories", body);
}

export function updateServiceCategory(
  id: string,
  body: { name?: string; description?: string; sortOrder?: number },
): Promise<ServiceCategoryView> {
  return apiPatch<ServiceCategoryView>(`/api/v1/service-categories/${id}`, body);
}

export function setServiceCategoryStatus(id: string, active: boolean): Promise<ServiceCategoryView> {
  return apiPatch<ServiceCategoryView>(`/api/v1/service-categories/${id}/status`, { active });
}

// ---- Payment types ----

export function listPaymentTypes(params: ListParams = {}): Promise<PaginatedResult<ReferenceItemView>> {
  return apiGet<PaginatedResult<ReferenceItemView>>(`/api/v1/payment-types${qs(params)}`);
}

export function createPaymentType(body: { code: string; name: string }): Promise<ReferenceItemView> {
  return apiPost<ReferenceItemView>("/api/v1/payment-types", body);
}

export function updatePaymentType(id: string, body: { name?: string; sortOrder?: number }): Promise<ReferenceItemView> {
  return apiPatch<ReferenceItemView>(`/api/v1/payment-types/${id}`, body);
}

export function setPaymentTypeStatus(id: string, active: boolean): Promise<ReferenceItemView> {
  return apiPatch<ReferenceItemView>(`/api/v1/payment-types/${id}/status`, { active });
}

// ---- Languages ----

export function listLanguages(params: ListParams = {}): Promise<PaginatedResult<ReferenceItemView>> {
  return apiGet<PaginatedResult<ReferenceItemView>>(`/api/v1/languages${qs(params)}`);
}

export function createLanguage(body: { code: string; name: string }): Promise<ReferenceItemView> {
  return apiPost<ReferenceItemView>("/api/v1/languages", body);
}

export function updateLanguage(id: string, body: { name?: string; sortOrder?: number }): Promise<ReferenceItemView> {
  return apiPatch<ReferenceItemView>(`/api/v1/languages/${id}`, body);
}

export function setLanguageStatus(id: string, active: boolean): Promise<ReferenceItemView> {
  return apiPatch<ReferenceItemView>(`/api/v1/languages/${id}/status`, { active });
}
