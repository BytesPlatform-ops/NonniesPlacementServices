"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import type { PaginatedResult } from "@/types/api";
import type { ReferenceItemView, ServiceCategoryView } from "@/types/catalog";
import {
  createLanguage,
  createPaymentType,
  createServiceCategory,
  listLanguages,
  listPaymentTypes,
  listServiceCategories,
  setLanguageStatus,
  setPaymentTypeStatus,
  setServiceCategoryStatus,
} from "@/services/catalog.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type Tab = "categories" | "payment" | "languages";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "categories", label: "Service categories" },
  { key: "payment", label: "Payment types" },
  { key: "languages", label: "Languages" },
];

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function CatalogAdminView() {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <div className="space-y-6">
      <PageHeading title="Service categories" description="Manage the reference catalogs used across provider profiles." />
      <div className="border-b border-sage">
        <nav className="-mb-px flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "border-brand-600 text-umber" : "border-transparent text-slate-500 hover:text-umber",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      {tab === "categories" ? <ServiceCategorySection /> : null}
      {tab === "payment" ? (
        <ReferenceSection
          noun="payment type"
          load={() => listPaymentTypes({ pageSize: 100 })}
          create={(code, name) => createPaymentType({ code, name })}
          setStatus={setPaymentTypeStatus}
        />
      ) : null}
      {tab === "languages" ? (
        <ReferenceSection
          noun="language"
          load={() => listLanguages({ pageSize: 100 })}
          create={(code, name) => createLanguage({ code, name })}
          setStatus={setLanguageStatus}
        />
      ) : null}
    </div>
  );
}

function ServiceCategorySection() {
  const { data, loading, error, reload } = useAsync(() => listServiceCategories({ pageSize: 100 }), []);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await createServiceCategory({ code: form.code, name: form.name, description: form.description || undefined });
      setForm({ code: "", name: "", description: "" });
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create category.");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (row: ServiceCategoryView) => {
    await setServiceCategoryStatus(row.id, !row.active);
    await reload();
  };

  const columns: Column<ServiceCategoryView>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs text-slate-500">{r.code}</span> },
    { key: "used", header: "In use", align: "right", render: (r) => r.providerServicesCount },
    { key: "status", header: "Status", render: (r) => <StatusBadge label={r.active ? "Active" : "Inactive"} tone={r.active ? "positive" : "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button type="button" onClick={() => void toggle(r)} className="text-sm font-medium text-brand-700 hover:underline">
          {r.active ? "Deactivate" : "Activate"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title="New service category">
        {formError ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Code</span>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="HOME_HEALTH" className={`${inputCls} font-mono`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Description</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
              {busy ? "Creating…" : "Create category"}
            </button>
          </div>
        </form>
      </Panel>
      <Panel>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No categories" />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
        )}
      </Panel>
    </div>
  );
}

function ReferenceSection({
  noun,
  load,
  create,
  setStatus,
}: {
  noun: string;
  load: () => Promise<PaginatedResult<ReferenceItemView>>;
  create: (code: string, name: string) => Promise<ReferenceItemView>;
  setStatus: (id: string, active: boolean) => Promise<ReferenceItemView>;
}) {
  const { data, loading, error, reload } = useAsync(load, [noun]);
  const [form, setForm] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await create(form.code, form.name);
      setForm({ code: "", name: "" });
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : `Could not create ${noun}.`);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (row: ReferenceItemView) => {
    await setStatus(row.id, !row.active);
    await reload();
  };

  const columns: Column<ReferenceItemView>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs text-slate-500">{r.code}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge label={r.active ? "Active" : "Inactive"} tone={r.active ? "positive" : "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button type="button" onClick={() => void toggle(r)} className="text-sm font-medium text-brand-700 hover:underline">
          {r.active ? "Deactivate" : "Activate"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title={`New ${noun}`}>
        {formError ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Code</span>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${inputCls} font-mono`} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
              {busy ? "Creating…" : `Create ${noun}`}
            </button>
          </div>
        </form>
      </Panel>
      <Panel>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={`No ${noun}s`} />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
        )}
      </Panel>
    </div>
  );
}
