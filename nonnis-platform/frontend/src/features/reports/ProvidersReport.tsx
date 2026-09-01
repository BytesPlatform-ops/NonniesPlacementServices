"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import { getProvidersReport } from "@/services/reports.service";
import type { ProviderReportGroups, ProviderReportRow, ProviderReportSummary } from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { capacityTone, providerStatusTone } from "./report-shared";

const columns: Column<ProviderReportRow>[] = [
  {
    key: "provider",
    header: "Provider",
    render: (r) => (
      <Link href={`/providers/${r.id}`} className="font-medium text-brand-800 hover:underline">
        {r.displayName}
      </Link>
    ),
  },
  { key: "org", header: "Organization", render: (r) => r.organization ?? "—" },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.statusLabel} tone={providerStatusTone(r.status)} /> },
  { key: "location", header: "Location", render: (r) => r.location ?? "—" },
  { key: "services", header: "Services", align: "right", render: (r) => r.servicesCount },
  { key: "coverage", header: "Coverage", align: "right", render: (r) => r.coverageCount },
  { key: "languages", header: "Languages", align: "right", render: (r) => r.languagesCount },
  { key: "payment", header: "Payment", align: "right", render: (r) => r.paymentTypesCount },
  { key: "capacity", header: "Capacity", render: (r) => <StatusBadge label={r.capacity.toLowerCase()} tone={capacityTone(r.capacity)} /> },
  { key: "capUpdate", header: "Capacity updated", render: (r) => formatDate(r.lastCapacityUpdate) },
  { key: "updated", header: "Updated", render: (r) => formatDate(r.updatedAt) },
];

const filters: ReportFilterField[] = [
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "PAUSED", label: "Paused" },
      { value: "INACTIVE", label: "Inactive" },
    ],
  },
  { key: "serviceCategoryId", label: "Service", kind: "select", source: "serviceCategories" },
  {
    key: "capacityStatus",
    label: "Capacity",
    kind: "select",
    options: [
      { value: "AVAILABLE", label: "Available" },
      { value: "LIMITED", label: "Limited" },
      { value: "UNAVAILABLE", label: "Unavailable" },
      { value: "UNKNOWN", label: "Unknown" },
    ],
  },
  { key: "languageId", label: "Language", kind: "select", source: "languages" },
  { key: "paymentTypeId", label: "Payment", kind: "select", source: "paymentTypes" },
  { key: "state", label: "State", kind: "text", placeholder: "e.g. CA" },
  { key: "city", label: "City", kind: "text" },
  { key: "search", label: "Search", kind: "text", placeholder: "Name, city, state…" },
];

export function ProvidersReport() {
  return (
    <ReportView<ProviderReportRow, ProviderReportSummary, ProviderReportGroups>
      reportType="providers"
      title="Provider Directory Summary"
      description="Current provider directory: operational status, capacity, and coverage counts."
      scope={{ organization: true }}
      extraFilters={filters}
      fetcher={getProvidersReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Total", value: s.total },
        { label: "Active", value: s.active, tone: "positive" },
        { label: "Paused", value: s.paused, tone: "warning" },
        { label: "Inactive", value: s.inactive, tone: "neutral" },
        { label: "Available", value: s.available, tone: "positive" },
        { label: "Limited", value: s.limited, tone: "warning" },
        { label: "Unavailable", value: s.unavailable, tone: "negative" },
        { label: "Unknown cap.", value: s.unknownCapacity, tone: "neutral" },
      ]}
      groupSections={(g) => [
        { title: "Providers by Status", rows: g.byStatus },
        { title: "Providers by Capacity", rows: g.byCapacity },
      ]}
      emptyMessage="No providers match the current filters."
      loadingLabel="Loading providers…"
    />
  );
}
