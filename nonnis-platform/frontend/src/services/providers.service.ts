import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  CoverageAreaView,
  ProviderCapacityView,
  ProviderDetailView,
  ProviderHoursView,
  ProviderLanguageView,
  ProviderPaymentTypeView,
  ProviderServiceView,
  ProviderSummaryView,
  ProviderUserView,
} from "@/types/providers";

export interface ProviderFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  serviceCategoryId?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  languageId?: string;
  paymentTypeId?: string;
  availability?: string;
  sort?: string;
  order?: string;
}

export function listProviders(filters: ProviderFilters = {}): Promise<PaginatedResult<ProviderSummaryView>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const s = query.toString();
  return apiGet<PaginatedResult<ProviderSummaryView>>(`/api/v1/providers${s ? `?${s}` : ""}`);
}

export function getProvider(id: string): Promise<ProviderDetailView> {
  return apiGet<ProviderDetailView>(`/api/v1/providers/${id}`);
}

export function createProvider(body: Record<string, unknown>): Promise<ProviderDetailView> {
  return apiPost<ProviderDetailView>("/api/v1/providers", body);
}

export function updateProvider(id: string, body: Record<string, unknown>): Promise<ProviderDetailView> {
  return apiPatch<ProviderDetailView>(`/api/v1/providers/${id}`, body);
}

export function setProviderStatus(id: string, status: string): Promise<ProviderDetailView> {
  return apiPatch<ProviderDetailView>(`/api/v1/providers/${id}/status`, { status });
}

export interface PublicListingUpdate {
  isResidentialProvider?: boolean;
  publicSlug?: string;
  publicDescription?: string;
  publicFeaturedImageUrl?: string | null;
  publicFeaturedImageStoragePath?: string | null;
  publicSortOrder?: number;
}

export function updatePublicListing(id: string, body: PublicListingUpdate): Promise<ProviderDetailView> {
  return apiPatch<ProviderDetailView>(`/api/v1/providers/${id}/public-listing`, body);
}

export function publishProvider(id: string): Promise<ProviderDetailView> {
  return apiPost<ProviderDetailView>(`/api/v1/providers/${id}/public-listing/publish`, {});
}

export function unpublishProvider(id: string): Promise<ProviderDetailView> {
  return apiPost<ProviderDetailView>(`/api/v1/providers/${id}/public-listing/unpublish`, {});
}

export function listProviderUsers(id: string): Promise<ProviderUserView[]> {
  return apiGet<ProviderUserView[]>(`/api/v1/providers/${id}/users`);
}

// ---- Services ----

export function createProviderService(
  providerId: string,
  body: { serviceCategoryId: string; description?: string; levelOfCare?: string; active?: boolean },
): Promise<ProviderServiceView> {
  return apiPost<ProviderServiceView>(`/api/v1/providers/${providerId}/services`, body);
}

export function updateProviderService(
  providerId: string,
  serviceId: string,
  body: { description?: string; levelOfCare?: string; active?: boolean },
): Promise<ProviderServiceView> {
  return apiPatch<ProviderServiceView>(`/api/v1/providers/${providerId}/services/${serviceId}`, body);
}

export function removeProviderService(providerId: string, serviceId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/providers/${providerId}/services/${serviceId}`);
}

// ---- Coverage ----

export function createCoverage(providerId: string, body: Record<string, unknown>): Promise<CoverageAreaView> {
  return apiPost<CoverageAreaView>(`/api/v1/providers/${providerId}/coverage`, body);
}

export function updateCoverage(
  providerId: string,
  coverageId: string,
  body: Record<string, unknown>,
): Promise<CoverageAreaView> {
  return apiPatch<CoverageAreaView>(`/api/v1/providers/${providerId}/coverage/${coverageId}`, body);
}

export function removeCoverage(providerId: string, coverageId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/providers/${providerId}/coverage/${coverageId}`);
}

// ---- Payment types ----

export function addProviderPaymentType(
  providerId: string,
  body: { paymentTypeId: string; notes?: string },
): Promise<ProviderPaymentTypeView> {
  return apiPost<ProviderPaymentTypeView>(`/api/v1/providers/${providerId}/payment-types`, body);
}

export function removeProviderPaymentType(providerId: string, id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/providers/${providerId}/payment-types/${id}`);
}

// ---- Languages ----

export function addProviderLanguage(
  providerId: string,
  body: { languageId: string },
): Promise<ProviderLanguageView> {
  return apiPost<ProviderLanguageView>(`/api/v1/providers/${providerId}/languages`, body);
}

export function removeProviderLanguage(providerId: string, id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/providers/${providerId}/languages/${id}`);
}

// ---- Hours ----

export function getProviderHours(providerId: string): Promise<ProviderHoursView[]> {
  return apiGet<ProviderHoursView[]>(`/api/v1/providers/${providerId}/hours`);
}

export function setProviderHours(
  providerId: string,
  hours: Array<Record<string, unknown>>,
): Promise<ProviderHoursView[]> {
  return apiPut<ProviderHoursView[]>(`/api/v1/providers/${providerId}/hours`, { hours });
}

// ---- Capacity ----

export function setProviderCapacity(
  providerId: string,
  body: { serviceCategoryId?: string | null; status: string; availableCount?: number; effectiveDate?: string; notes?: string },
): Promise<ProviderCapacityView> {
  return apiPut<ProviderCapacityView>(`/api/v1/providers/${providerId}/capacity`, body);
}

export function removeProviderCapacity(providerId: string, capacityId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/providers/${providerId}/capacity/${capacityId}`);
}
