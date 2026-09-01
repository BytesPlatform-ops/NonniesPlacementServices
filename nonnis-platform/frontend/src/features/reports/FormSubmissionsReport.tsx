"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import { getFormSubmissionsReport } from "@/services/reports.service";
import type {
  FormSubmissionReportGroups,
  FormSubmissionReportRow,
  FormSubmissionReportSummary,
} from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { formStatusTone, last30Days } from "./report-shared";

const columns: Column<FormSubmissionReportRow>[] = [
  {
    key: "ref",
    header: "Submission",
    render: (r) => (
      <Link href="/operations/form-submissions" className="font-medium text-brand-800 hover:underline">
        {r.reference}
      </Link>
    ),
  },
  { key: "form", header: "Form", render: (r) => r.formName },
  { key: "submitter", header: "Submitter", render: (r) => r.submitterName ?? "—" },
  { key: "submitted", header: "Submitted", render: (r) => formatDate(r.submittedAt) },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.statusLabel} tone={formStatusTone(r.status)} /> },
  { key: "reviewed", header: "Reviewed", render: (r) => (r.reviewed ? "Yes" : <span className="text-slate-400">No</span>) },
  { key: "reviewedBy", header: "Reviewed by", render: (r) => r.reviewedBy ?? "—" },
];

const filters: ReportFilterField[] = [
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: [
      { value: "NEW", label: "New" },
      { value: "IN_REVIEW", label: "In review" },
      { value: "RESOLVED", label: "Resolved" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  },
  {
    key: "reviewed",
    label: "Reviewed",
    kind: "select",
    options: [
      { value: "true", label: "Reviewed" },
      { value: "false", label: "Not reviewed" },
    ],
  },
  { key: "formKey", label: "Form key", kind: "text", placeholder: "e.g. contact" },
  { key: "search", label: "Search", kind: "text", placeholder: "Reference, submitter, form…" },
];

export function FormSubmissionsReport() {
  return (
    <ReportView<FormSubmissionReportRow, FormSubmissionReportSummary, FormSubmissionReportGroups>
      reportType="form-submissions"
      title="Website Form Submission Report"
      description="Public website form submissions received. Full submission details remain in the review screen."
      scope={{ dateRange: true }}
      extraFilters={filters}
      defaults={last30Days()}
      fetcher={getFormSubmissionsReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Total received", value: s.total },
        { label: "New", value: s.new, tone: "info" },
        { label: "In review", value: s.inReview, tone: "warning" },
        { label: "Resolved", value: s.resolved, tone: "positive" },
        { label: "Archived", value: s.archived, tone: "neutral" },
      ]}
      groupSections={(g) => [{ title: "Submissions by Form", rows: g.byForm }]}
      emptyMessage="No submissions match the current filters."
      loadingLabel="Loading submissions…"
    />
  );
}
