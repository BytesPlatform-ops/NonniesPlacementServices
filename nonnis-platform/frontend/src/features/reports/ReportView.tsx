"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useAsync } from "@/hooks/use-async";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { MutationButton } from "@/components/ui/MutationButton";
import {
  exportReport,
  getReportFilterOptions,
  type ReportQuery,
} from "@/services/reports.service";
import type { ReportFilterOptions, ReportResponse } from "@/types/reports";
import { GroupTables, SummaryCards, type GroupSection, type SummaryCard } from "./report-shared";
import { useReportQueryState } from "./useReportQueryState";

type OptionSource = "organizations" | "facilities" | "serviceCategories" | "languages" | "paymentTypes";

export interface ReportFilterField {
  key: string;
  label: string;
  kind: "text" | "select" | "toggle" | "date";
  source?: OptionSource;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const PAGE_SIZE = 20;
const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export interface ReportViewProps<Row, Summary, Groups> {
  reportType: string;
  title: string;
  description: string;
  scope?: { dateRange?: boolean; organization?: boolean; facility?: boolean };
  extraFilters?: ReportFilterField[];
  defaults?: Record<string, string>;
  fetcher: (q: ReportQuery) => Promise<ReportResponse<Row, Summary, Groups>>;
  columns: Column<Row>[];
  getRowKey: (r: Row) => string;
  summaryCards: (s: Summary) => SummaryCard[];
  groupSections?: (g: Groups) => GroupSection[];
  emptyMessage?: string;
  loadingLabel?: string;
}

export function ReportView<Row, Summary, Groups>({
  reportType,
  title,
  description,
  scope = {},
  extraFilters = [],
  defaults = {},
  fetcher,
  columns,
  getRowKey,
  summaryCards,
  groupSections,
  emptyMessage = "No records match the current filters.",
  loadingLabel = "Loading report…",
}: ReportViewProps<Row, Summary, Groups>) {
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.REPORTS_EXPORT);
  const { values, page, setValue, setPage, reset } = useReportQueryState(defaults);
  const { data: options } = useAsync(() => getReportFilterOptions(), []);

  const query: ReportQuery = { ...values, page, pageSize: PAGE_SIZE };
  // Report filters live in the URL, so `values` takes a fresh object identity
  // every time the query string is rewritten — even when the effective filters
  // are identical. Keying the fetch on the serialized query (with stable key
  // order) means an unchanged filter set never re-fires the same expensive
  // report request.
  const queryKey = useMemo(() => {
    const merged: Record<string, string> = { ...values, page: String(page), pageSize: String(PAGE_SIZE) };
    return JSON.stringify(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  }, [values, page]);
  const { data, loading, error, reload } = useAsync(() => fetcher(query), [queryKey]);
  const totalPages = data?.totalPages ?? 0;

  const optionsFor = (source?: OptionSource): Array<{ value: string; label: string }> => {
    if (!source || !options) return [];
    if (source === "facilities") {
      const orgId = values.organizationId;
      return options.facilities
        .filter((f) => !orgId || f.organizationId === orgId)
        .map((f) => ({ value: f.id, label: f.name }));
    }
    const list = options[source] as ReportFilterOptions["organizations"];
    return list.map((o) => ({ value: o.id, label: o.name }));
  };

  // Build the ordered list of rendered fields (built-in scope first, then report-specific).
  const scopeSelects: ReportFilterField[] = [];
  if (scope.organization) scopeSelects.push({ key: "organizationId", label: "Organization", kind: "select", source: "organizations" });
  if (scope.facility) scopeSelects.push({ key: "facilityId", label: "Facility", kind: "select", source: "facilities" });
  const allFields = [...scopeSelects, ...extraFilters];

  const chips = buildChips(values, allFields, optionsFor, scope.dateRange ?? false);

  return (
    <div id="report-print" className="space-y-4">
      <PageHeading
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-2 print-hide">
            {canExport ? (
              <MutationButton
                variant="secondary"
                action={() => exportReport(reportType, values)}
                successToast="Export downloaded"
                errorToast="Could not export the report"
              >
                Export CSV
              </MutationButton>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
          </div>
        }
      />

      {/* Print-only context so a paper copy is understandable later. */}
      <div className="print-only text-sm text-slate-700">
        <p>
          <strong>Generated:</strong> {data ? new Date(data.generatedAt).toLocaleString() : "—"}
        </p>
        {scope.dateRange ? (
          <p>
            <strong>Period:</strong> {values.dateFrom ? formatDate(values.dateFrom) : "Any"} –{" "}
            {values.dateTo ? formatDate(values.dateTo) : "Any"}
          </p>
        ) : null}
        {chips.length > 0 ? (
          <p>
            <strong>Filters:</strong> {chips.map((c) => c.label).join("; ")}
          </p>
        ) : null}
      </div>

      {/* Filter bar */}
      <Panel className="print-hide">
        <div className="flex flex-wrap items-end gap-3">
          {scope.dateRange ? (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">From</span>
                <input type="date" value={values.dateFrom ?? ""} onChange={(e) => setValue("dateFrom", e.target.value)} className={`${inputCls} bg-white`} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">To</span>
                <input type="date" value={values.dateTo ?? ""} onChange={(e) => setValue("dateTo", e.target.value)} className={`${inputCls} bg-white`} />
              </label>
            </>
          ) : null}

          {allFields.map((field) => (
            <FilterFieldControl
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              options={field.options ?? optionsFor(field.source)}
              onChange={(v) => setValue(field.key, v)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setValue(chip.key, undefined)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-600 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
            >
              {chip.label}
              <span aria-hidden>×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {chips.length > 0 ? (
            <button type="button" onClick={reset} className="text-xs font-medium text-slate-500 underline hover:text-umber">
              Reset filters
            </button>
          ) : null}
        </div>
      </Panel>

      {/* Summary */}
      {data ? <SummaryCards cards={summaryCards(data.summary)} /> : null}

      {/* Grouped counts */}
      {data && groupSections ? <GroupTables sections={groupSections(data.groups)} /> : null}

      {/* Table */}
      <Panel title={title} description={data ? `${data.total} record${data.total === 1 ? "" : "s"}` : undefined}>
        {loading ? (
          <LoadingState label={loadingLabel} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No records" message={emptyMessage} />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={getRowKey} />
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500 print-hide">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">
                    Previous
                  </button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}

function FilterFieldControl({
  field,
  value,
  options,
  onChange,
}: {
  field: ReportFilterField;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
}) {
  if (field.kind === "toggle") {
    const active = value === "true";
    return (
      <button
        type="button"
        onClick={() => onChange(active ? undefined : "true")}
        aria-pressed={active}
        className={cn(
          "mt-5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          active ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400",
        )}
      >
        {field.label}
      </button>
    );
  }
  if (field.kind === "date") {
    return (
      <label className="block">
        <span className="text-xs font-medium text-slate-600">{field.label}</span>
        <input type="date" value={value} onChange={(e) => onChange(e.target.value || undefined)} className={`${inputCls} bg-white`} />
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="block">
        <span className="text-xs font-medium text-slate-600">{field.label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value || undefined)} className={`${inputCls} bg-white`}>
          <option value="">{field.placeholder ?? `Any ${field.label.toLowerCase()}`}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return <TextFilter field={field} value={value} onChange={onChange} />;
}

/** Debounced text input so typing doesn't refetch on every keystroke. */
function TextFilter({
  field,
  value,
  onChange,
}: {
  field: ReportFilterField;
  value: string;
  onChange: (value: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== value) onChange(draft || undefined);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{field.label}</span>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={field.placeholder} className={inputCls} />
    </label>
  );
}

interface Chip {
  key: string;
  label: string;
}

function buildChips(
  values: Record<string, string>,
  fields: ReportFilterField[],
  optionsFor: (source?: OptionSource) => Array<{ value: string; label: string }>,
  hasDateRange: boolean,
): Chip[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const chips: Chip[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!value || key === "page" || key === "pageSize") continue;
    if (key === "dateFrom") {
      chips.push({ key, label: `From ${value}` });
      continue;
    }
    if (key === "dateTo") {
      chips.push({ key, label: `To ${value}` });
      continue;
    }
    if (!hasDateRange && (key === "dateFrom" || key === "dateTo")) continue;
    const field = byKey.get(key);
    if (!field) continue;
    if (field.kind === "toggle") {
      chips.push({ key, label: field.label });
      continue;
    }
    const opts = field.options ?? optionsFor(field.source);
    const match = opts.find((o) => o.value === value);
    chips.push({ key, label: `${field.label}: ${match?.label ?? value}` });
  }
  return chips;
}
