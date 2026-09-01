import { apiDownload, apiGet } from "@/lib/api-client";
import type {
  CaseReportGroups,
  CaseReportRow,
  CaseReportSummary,
  FormSubmissionReportGroups,
  FormSubmissionReportRow,
  FormSubmissionReportSummary,
  OverviewSummary,
  ProviderReportGroups,
  ProviderReportRow,
  ProviderReportSummary,
  ReadinessReportRow,
  ReadinessReportSummary,
  ReferralReportGroups,
  ReferralReportRow,
  ReferralReportSummary,
  ReportFilterOptions,
  ReportResponse,
  TaskReportGroups,
  TaskReportRow,
  TaskReportSummary,
} from "@/types/reports";

export type ReportQuery = Record<string, string | number | boolean | undefined>;

/** Build a query string, dropping empty/undefined/false values (matches other services). */
export function reportQs(filters: ReportQuery): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `?${s}` : "";
}

export function getReportFilterOptions(): Promise<ReportFilterOptions> {
  return apiGet<ReportFilterOptions>("/api/v1/reports/filter-options");
}

export function getReportOverview(filters: ReportQuery): Promise<OverviewSummary> {
  return apiGet<OverviewSummary>(`/api/v1/reports/overview${reportQs(filters)}`);
}

export function getCasesReport(
  filters: ReportQuery,
): Promise<ReportResponse<CaseReportRow, CaseReportSummary, CaseReportGroups>> {
  return apiGet(`/api/v1/reports/cases${reportQs(filters)}`);
}

export function getReferralsReport(
  filters: ReportQuery,
): Promise<ReportResponse<ReferralReportRow, ReferralReportSummary, ReferralReportGroups>> {
  return apiGet(`/api/v1/reports/referrals${reportQs(filters)}`);
}

export function getProvidersReport(
  filters: ReportQuery,
): Promise<ReportResponse<ProviderReportRow, ProviderReportSummary, ProviderReportGroups>> {
  return apiGet(`/api/v1/reports/providers${reportQs(filters)}`);
}

export function getReadinessReport(
  filters: ReportQuery,
): Promise<ReportResponse<ReadinessReportRow, ReadinessReportSummary, Record<string, never>>> {
  return apiGet(`/api/v1/reports/readiness${reportQs(filters)}`);
}

export function getTasksReport(
  filters: ReportQuery,
): Promise<ReportResponse<TaskReportRow, TaskReportSummary, TaskReportGroups>> {
  return apiGet(`/api/v1/reports/tasks${reportQs(filters)}`);
}

export function getFormSubmissionsReport(
  filters: ReportQuery,
): Promise<ReportResponse<FormSubmissionReportRow, FormSubmissionReportSummary, FormSubmissionReportGroups>> {
  return apiGet(`/api/v1/reports/form-submissions${reportQs(filters)}`);
}

/** Trigger a CSV download for a report using the same active filters. */
export function exportReport(reportType: string, filters: ReportQuery): Promise<void> {
  return apiDownload(`/api/v1/reports/${reportType}/export${reportQs(filters)}`, `nonnis-${reportType}.csv`);
}
