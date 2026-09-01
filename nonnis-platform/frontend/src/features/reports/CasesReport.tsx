"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CASE_STATUS_ORDER, caseStatusMeta } from "@/lib/case-status";
import type { CaseStatus } from "@/types/domain";
import { formatDate } from "@/lib/format";
import { getCasesReport } from "@/services/reports.service";
import type { CaseReportGroups, CaseReportRow, CaseReportSummary } from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { last30Days, readinessTone } from "./report-shared";

const columns: Column<CaseReportRow>[] = [
  {
    key: "case",
    header: "Case",
    render: (r) => (
      <div>
        <Link href={`/cases/${r.id}`} className="font-medium text-brand-800 hover:underline">
          {r.caseNumber}
        </Link>
        {r.patientName ? <p className="text-xs text-slate-500">{r.patientName}</p> : null}
      </div>
    ),
  },
  { key: "org", header: "Organization", render: (r) => r.organization ?? "—" },
  { key: "facility", header: "Facility", render: (r) => r.facility ?? "—" },
  { key: "assigned", header: "Assigned", render: (r) => r.assignedProfessional ?? <span className="text-amber-700">Unassigned</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={caseStatusMeta(r.status as CaseStatus).label} tone={caseStatusMeta(r.status as CaseStatus).tone} /> },
  {
    key: "readiness",
    header: "Readiness",
    render: (r) => (
      <div className="flex items-center gap-2">
        <StatusBadge label={r.readinessLevel.replace(/_/g, " ").toLowerCase()} tone={readinessTone(r.readinessLevel)} />
        <span className="text-xs tabular-nums text-slate-500">{r.readinessPercentage}%</span>
      </div>
    ),
  },
  { key: "created", header: "Created", render: (r) => formatDate(r.createdAt) },
  { key: "discharge", header: "Expected", render: (r) => formatDate(r.expectedDischargeDate) },
  { key: "blockers", header: "Blockers", align: "right", render: (r) => r.criticalBlockers },
];

const filters: ReportFilterField[] = [
  { key: "status", label: "Status", kind: "select", options: CASE_STATUS_ORDER.map((s) => ({ value: s, label: caseStatusMeta(s).label })) },
  {
    key: "readinessLevel",
    label: "Readiness",
    kind: "select",
    options: [
      { value: "READY", label: "Ready" },
      { value: "NEEDS_ATTENTION", label: "Needs attention" },
      { value: "BLOCKED", label: "Blocked" },
    ],
  },
  { key: "search", label: "Search", kind: "text", placeholder: "Case #, patient…" },
];

export function CasesReport() {
  return (
    <ReportView<CaseReportRow, CaseReportSummary, CaseReportGroups>
      reportType="cases"
      title="Case Report"
      description="Administrative case counts and current status across organizations. Date range applies to case creation."
      scope={{ dateRange: true, organization: true, facility: true }}
      extraFilters={filters}
      defaults={last30Days()}
      fetcher={getCasesReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Total", value: s.total },
        { label: "Active", value: s.active, tone: "info" },
        { label: "Completed", value: s.completed, tone: "positive" },
        { label: "Cancelled", value: s.cancelled, tone: "neutral" },
        { label: "Ready", value: s.ready, tone: "positive" },
        { label: "Blocked", value: s.blocked, tone: "negative" },
      ]}
      groupSections={(g) => [
        { title: "Cases by Status", rows: g.byStatus },
        { title: "Cases by Organization", rows: g.byOrganization },
        { title: "Cases by Facility", rows: g.byFacility },
      ]}
      emptyMessage="No cases match the current filters."
      loadingLabel="Loading cases…"
    />
  );
}
