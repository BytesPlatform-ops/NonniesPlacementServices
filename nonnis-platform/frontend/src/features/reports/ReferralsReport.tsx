"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import { getReferralsReport } from "@/services/reports.service";
import type { ReferralReportGroups, ReferralReportRow, ReferralReportSummary } from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { last30Days, referralStatusTone } from "./report-shared";

const columns: Column<ReferralReportRow>[] = [
  { key: "ref", header: "Referral", render: (r) => <span className="font-medium text-umber">{r.reference}</span> },
  {
    key: "case",
    header: "Case",
    render: (r) => (
      <Link href={`/cases/${r.caseId}`} className="text-brand-800 hover:underline">
        {r.caseNumber}
      </Link>
    ),
  },
  { key: "org", header: "Organization", render: (r) => r.organization ?? "—" },
  { key: "service", header: "Service", render: (r) => r.service ?? "—" },
  { key: "provider", header: "Provider", render: (r) => r.provider ?? "—" },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.statusLabel} tone={referralStatusTone(r.status)} /> },
  { key: "overdue", header: "Overdue", render: (r) => (r.overdue ? <span className="text-rose-600">Overdue</span> : <span className="text-slate-400">—</span>) },
  { key: "sent", header: "Sent", render: (r) => formatDate(r.sentAt) },
  { key: "due", header: "Due", render: (r) => formatDate(r.responseDueAt) },
  { key: "placement", header: "Placement", render: (r) => (r.placementStatus ? r.placementStatus.replace(/_/g, " ").toLowerCase() : "—") },
  { key: "scheduled", header: "Scheduled", render: (r) => formatDate(r.scheduledStartAt) },
  { key: "actual", header: "Actual start", render: (r) => formatDate(r.actualStartAt) },
];

const filters: ReportFilterField[] = [
  {
    key: "referralStatus",
    label: "Status",
    kind: "select",
    options: [
      "DRAFT",
      "SENT",
      "VIEWED",
      "INFORMATION_REQUESTED",
      "CONDITIONALLY_ACCEPTED",
      "ACCEPTED",
      "DECLINED",
      "WITHDRAWN",
      "CANCELLED",
    ].map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() })),
  },
  { key: "serviceCategoryId", label: "Service", kind: "select", source: "serviceCategories" },
  { key: "overdue", label: "Overdue only", kind: "toggle" },
  { key: "includeDrafts", label: "Include drafts", kind: "toggle" },
  { key: "search", label: "Search", kind: "text", placeholder: "Reference, case, provider…" },
];

export function ReferralsReport() {
  return (
    <ReportView<ReferralReportRow, ReferralReportSummary, ReferralReportGroups>
      reportType="referrals"
      title="Referral Report"
      description="Referral counts and current statuses. Date range applies to when a referral was sent."
      scope={{ dateRange: true, organization: true, facility: true }}
      extraFilters={filters}
      defaults={last30Days()}
      fetcher={getReferralsReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Total", value: s.total },
        { label: "Sent", value: s.byStatus.SENT ?? 0, tone: "info" },
        { label: "Accepted", value: s.byStatus.ACCEPTED ?? 0, tone: "positive" },
        { label: "Cond. accepted", value: s.byStatus.CONDITIONALLY_ACCEPTED ?? 0, tone: "warning" },
        { label: "Declined", value: s.byStatus.DECLINED ?? 0, tone: "negative" },
        { label: "Overdue", value: s.overdue, tone: "negative" },
      ]}
      groupSections={(g) => [{ title: "Referrals by Status", rows: g.byStatus }]}
      emptyMessage="No referrals match the current filters."
      loadingLabel="Loading referrals…"
    />
  );
}
