"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CASE_STATUS_ORDER, caseStatusMeta } from "@/lib/case-status";
import type { CaseStatus } from "@/types/domain";
import { formatDate } from "@/lib/format";
import { getReadinessReport } from "@/services/reports.service";
import type { ReadinessReportRow, ReadinessReportSummary } from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { readinessTone } from "./report-shared";

const columns: Column<ReadinessReportRow>[] = [
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
  { key: "expected", header: "Expected discharge", render: (r) => formatDate(r.expectedDischargeDate) },
  { key: "status", header: "Case status", render: (r) => <StatusBadge label={caseStatusMeta(r.status as CaseStatus).label} tone={caseStatusMeta(r.status as CaseStatus).tone} /> },
  { key: "pct", header: "Readiness %", align: "right", render: (r) => `${r.readinessPercentage}%` },
  { key: "level", header: "Level", render: (r) => <StatusBadge label={r.readinessLevel.replace(/_/g, " ").toLowerCase()} tone={readinessTone(r.readinessLevel)} /> },
  { key: "critical", header: "Critical", align: "right", render: (r) => r.criticalBlockers },
  { key: "blockers", header: "Key blockers", render: (r) => (r.keyBlockers.length ? r.keyBlockers.join(", ") : <span className="text-slate-400">—</span>) },
];

const filters: ReportFilterField[] = [
  { key: "status", label: "Case status", kind: "select", options: CASE_STATUS_ORDER.map((s) => ({ value: s, label: caseStatusMeta(s).label })) },
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
  {
    key: "blockerType",
    label: "Blocker",
    kind: "select",
    options: [
      { value: "CRITICAL_BLOCKER", label: "Critical blocker" },
      { value: "PLACEMENT_MISSING", label: "Placement missing" },
      { value: "SERVICE_UNSCHEDULED", label: "Service unscheduled" },
      { value: "DISCHARGED_NOT_STARTED", label: "Discharged, not started" },
      { value: "NEAR_TERM_NOT_READY", label: "Near-term, not ready" },
    ],
  },
  { key: "expectedFrom", label: "Expected from", kind: "date" },
  { key: "expectedTo", label: "Expected to", kind: "date" },
  { key: "search", label: "Search", kind: "text", placeholder: "Case #, patient…" },
];

export function ReadinessReport() {
  return (
    <ReportView<ReadinessReportRow, ReadinessReportSummary, Record<string, never>>
      reportType="readiness"
      title="Readiness Snapshot"
      description="Current discharge-readiness state per case, computed live from source records. Point-in-time snapshot — no history."
      scope={{ organization: true, facility: true }}
      extraFilters={filters}
      fetcher={getReadinessReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Ready", value: s.ready, tone: "positive" },
        { label: "Needs attention", value: s.needsAttention, tone: "warning" },
        { label: "Blocked", value: s.blocked, tone: "negative" },
        { label: "Near-term not ready", value: s.nearTermNotReady, tone: "warning" },
        { label: "Placement missing", value: s.placementMissing, tone: "warning" },
        { label: "Accepted, unscheduled", value: s.acceptedUnscheduled, tone: "warning" },
        { label: "Discharged, not started", value: s.dischargedServiceNotStarted, tone: "negative" },
        { label: "Unsuccessful starts", value: s.unsuccessfulServiceStarts, tone: "negative" },
      ]}
      emptyMessage="No cases match the current filters."
      loadingLabel="Loading readiness snapshot…"
    />
  );
}
