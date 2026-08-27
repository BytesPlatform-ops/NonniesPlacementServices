import { apiGet } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { CaseDetail, CaseStatus, CaseSummary } from "@/types/domain";

export interface ListCasesParams {
  page?: number;
  pageSize?: number;
  status?: CaseStatus;
}

/** Fetch a paginated list of cases. */
export function listCases(params: ListCasesParams = {}): Promise<PaginatedResult<CaseSummary>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiGet<PaginatedResult<CaseSummary>>(`/api/v1/cases${qs ? `?${qs}` : ""}`);
}

/** Fetch a single case with its full detail. */
export function getCase(id: string): Promise<CaseDetail> {
  return apiGet<CaseDetail>(`/api/v1/cases/${encodeURIComponent(id)}`);
}
