"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { humanizeEnum } from "@/lib/format";
import { capacityLabel, capacityTone, providerStatusTone } from "@/lib/provider-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { listProviders, type ProviderFilters } from "@/services/providers.service";
import { listServiceCategories, listLanguages, listPaymentTypes } from "@/services/catalog.service";
import type { ProviderSummaryView } from "@/types/providers";
import { CAPACITY_STATUSES, PROVIDER_STATUSES } from "@/types/providers";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const PAGE_SIZE = 20;

export function ProvidersListView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PROVIDERS_MANAGE);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [availability, setAvailability] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, serviceCategoryId, availability, languageId, paymentTypeId, state, sort]);

  const filters: ProviderFilters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: debouncedQ || undefined,
      status: status || undefined,
      serviceCategoryId: serviceCategoryId || undefined,
      availability: availability || undefined,
      languageId: languageId || undefined,
      paymentTypeId: paymentTypeId || undefined,
      state: state || undefined,
      sort,
    }),
    [page, debouncedQ, status, serviceCategoryId, availability, languageId, paymentTypeId, state, sort],
  );

  const { data, loading, error, reload } = useAsync(() => listProviders(filters), [filters]);
  const categories = useAsync(() => listServiceCategories({ activeOnly: true, pageSize: 100 }), []);
  const languages = useAsync(() => listLanguages({ activeOnly: true, pageSize: 100 }), []);
  const payments = useAsync(() => listPaymentTypes({ activeOnly: true, pageSize: 100 }), []);

  const totalPages = data?.totalPages ?? 0;

  const columns: Column<ProviderSummaryView>[] = [
    {
      key: "provider",
      header: "Provider",
      render: (row) => (
        <div>
          <Link href={`/providers/${row.id}`} className="font-medium text-brand-800 hover:underline">
            {row.displayName}
          </Link>
          <p className="text-xs text-slate-500">{row.organizationName}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge label={humanizeEnum(row.status)} tone={providerStatusTone(row.status)} />,
    },
    { key: "services", header: "Services", align: "right", render: (row) => row.servicesCount },
    {
      key: "coverage",
      header: "Location",
      render: (row) => [row.city, row.state].filter(Boolean).join(", ") || "—",
    },
    {
      key: "availability",
      header: "Availability",
      render: (row) => <StatusBadge label={capacityLabel(row.availabilityStatus)} tone={capacityTone(row.availabilityStatus)} />,
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.phone || row.email || "—",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <Link href={`/providers/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          {row.editable ? "Manage" : "View"}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Providers"
        description="Browse, search and filter the provider directory for manual provider selection."
        actions={
          canManage ? (
            <Link href="/providers/new" className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
              New provider
            </Link>
          ) : undefined
        }
      />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, organization, city…"
              className={inputCls}
            />
          </label>
          <Select label="Status" value={status} onChange={setStatus} placeholder="Any status">
            {PROVIDER_STATUSES.map((s) => (
              <option key={s} value={s}>{humanizeEnum(s)}</option>
            ))}
          </Select>
          <Select label="Service category" value={serviceCategoryId} onChange={setServiceCategoryId} placeholder="Any service">
            {(categories.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Availability" value={availability} onChange={setAvailability} placeholder="Any availability">
            {CAPACITY_STATUSES.map((s) => (
              <option key={s} value={s}>{capacityLabel(s)}</option>
            ))}
          </Select>
          <Select label="Language" value={languageId} onChange={setLanguageId} placeholder="Any language">
            {(languages.data?.items ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
          <Select label="Payment / insurance" value={paymentTypeId} onChange={setPaymentTypeId} placeholder="Any payment">
            {(payments.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">State</span>
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. WA" className={inputCls} />
          </label>
          <Select label="Sort" value={sort} onChange={setSort}>
            <option value="name">Name</option>
            <option value="updatedAt">Recently updated</option>
            <option value="status">Status</option>
          </Select>
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
            <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                {data.total} provider{data.total === 1 ? "" : "s"}
              </span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function Select({
  label,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} bg-white`}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
    </label>
  );
}
