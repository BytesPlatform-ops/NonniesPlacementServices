"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { humanizeEnum } from "@/lib/format";
import { capacityLabel, capacityTone, providerStatusTone } from "@/lib/provider-status";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { listOperationsProviders, type OperationsProviderFilters } from "@/services/operations.service";
import type { ProviderSummaryView } from "@/types/providers";
import { PROVIDER_STATUSES, CAPACITY_STATUSES } from "@/types/providers";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function OperationsProviders() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState("");
  const [noServices, setNoServices] = useState(false);
  const [noCoverage, setNoCoverage] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, availability, noServices, noCoverage]);

  const filters: OperationsProviderFilters = useMemo(
    () => ({
      page,
      pageSize: 20,
      q: debounced || undefined,
      status: status || undefined,
      availability: availability || undefined,
      noServices,
      noCoverage,
      sort: "updatedAt",
    }),
    [page, debounced, status, availability, noServices, noCoverage],
  );

  const { data, loading, error, reload } = useAsync(() => listOperationsProviders(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<ProviderSummaryView>[] = [
    {
      key: "provider",
      header: "Provider",
      render: (row) => (
        <div>
          <Link href={`/providers/${row.id}`} className="font-medium text-brand-800 hover:underline">{row.displayName}</Link>
          <p className="text-xs text-slate-500">{row.organizationName}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={humanizeEnum(row.status)} tone={providerStatusTone(row.status)} /> },
    { key: "services", header: "Services", align: "right", render: (row) => row.servicesCount },
    { key: "coverage", header: "Coverage", align: "right", render: (row) => row.coverageAreasCount },
    { key: "availability", header: "Availability", render: (row) => <StatusBadge label={capacityLabel(row.availabilityStatus)} tone={capacityTone(row.availabilityStatus)} /> },
    { key: "location", header: "Location", render: (row) => [row.city, row.state].filter(Boolean).join(", ") || "—" },
    { key: "actions", header: "", align: "right", render: (row) => <Link href={`/providers/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">Open</Link> },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Provider operations" description="Operational overview of providers across the network." />

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, organization, city…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {PROVIDER_STATUSES.map((s) => (<option key={s} value={s}>{humanizeEnum(s)}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Availability</span>
            <select value={availability} onChange={(e) => setAvailability(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any availability</option>
              {CAPACITY_STATUSES.map((s) => (<option key={s} value={s}>{capacityLabel(s)}</option>))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "No services", value: noServices, set: setNoServices },
            { label: "No coverage", value: noCoverage, set: setNoCoverage },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => chip.set((v) => !v)}
              aria-pressed={chip.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                chip.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <LoadingState label="Loading providers…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No providers" message="No providers match the current filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} provider{data.total === 1 ? "" : "s"}</span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
