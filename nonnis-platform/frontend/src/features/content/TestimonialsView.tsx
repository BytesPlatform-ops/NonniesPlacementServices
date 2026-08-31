"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { activeLabel, activeTone } from "@/lib/content-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  setTestimonialActive,
  updateTestimonial,
  type TestimonialFilters,
} from "@/services/content.service";
import type { TestimonialView } from "@/types/content";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function attribution(t: TestimonialView): string {
  return [t.clientName, t.clientTitle, t.organization, t.location].filter(Boolean).join(" · ") || "Anonymous";
}

export function TestimonialsView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CONTENT_MANAGE);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TestimonialView | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const filters: TestimonialFilters = useMemo(() => ({ page, pageSize: 20, q: debounced || undefined }), [page, debounced]);
  const { data, loading, error: loadError, reload } = useAsync(() => listTestimonials(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<TestimonialView>[] = [
    {
      key: "quote",
      header: "Quote",
      render: (row) => (
        <div className="min-w-0 max-w-xl">
          <button type="button" onClick={() => canManage && setEditing(row)} className="line-clamp-2 text-left text-slate-800 hover:text-brand-700">“{row.quote}”</button>
          <p className="mt-0.5 truncate text-xs text-slate-500">{attribution(row)}</p>
        </div>
      ),
    },
    { key: "featured", header: "Featured", render: (row) => (row.featured ? <Star className="h-4 w-4 text-amber-500" aria-label="Featured" /> : <span className="text-slate-300">—</span>) },
    { key: "order", header: "Order", align: "right", render: (row) => row.sortOrder },
    { key: "active", header: "Status", render: (row) => <StatusBadge label={activeLabel(row.active)} tone={activeTone(row.active)} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        canManage ? (
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <button type="button" onClick={() => setEditing(row)} className="text-sm font-medium text-brand-700 hover:underline">Edit</button>
            <button type="button" disabled={busyId === row.id} onClick={() => void act(() => setTestimonialActive(row.id, !row.active), row.id)} className="text-sm text-slate-500 hover:text-umber disabled:opacity-50">{row.active ? "Deactivate" : "Activate"}</button>
            <button type="button" disabled={busyId === row.id} onClick={() => { if (window.confirm("Delete this testimonial?")) void act(() => deleteTestimonial(row.id), row.id); }} className="text-sm text-rose-600 hover:underline disabled:opacity-50">Delete</button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Testimonials"
        description="Manage the testimonials shown on the public homepage."
        actions={canManage ? <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">New testimonial</button> : undefined}
      />

      <Panel>
        <label className="block max-w-sm">
          <span className="text-xs font-medium text-slate-600">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Quote, name, or organization…" className={inputCls} />
        </label>
      </Panel>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <Panel title="Testimonials" description="Featured items appear first; then by sort order.">
        {loading ? (
          <LoadingState label="Loading testimonials…" />
        ) : loadError ? (
          <ErrorState message={loadError.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No testimonials" message="Add a testimonial to feature on the homepage." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} testimonial{data.total === 1 ? "" : "s"}</span>
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

      {creating ? <TestimonialModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); void reload(); }} /> : null}
      {editing ? <TestimonialModal testimonial={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void reload(); }} /> : null}
    </div>
  );
}

function TestimonialModal({ testimonial, onClose, onDone }: { testimonial?: TestimonialView; onClose: () => void; onDone: () => void }) {
  const [quote, setQuote] = useState(testimonial?.quote ?? "");
  const [clientName, setClientName] = useState(testimonial?.clientName ?? "");
  const [clientTitle, setClientTitle] = useState(testimonial?.clientTitle ?? "");
  const [organization, setOrganization] = useState(testimonial?.organization ?? "");
  const [location, setLocation] = useState(testimonial?.location ?? "");
  const [internalNotes, setInternalNotes] = useState(testimonial?.internalNotes ?? "");
  const [sortOrder, setSortOrder] = useState(String(testimonial?.sortOrder ?? 0));
  const [active, setActive] = useState(testimonial?.active ?? true);
  const [featured, setFeatured] = useState(testimonial?.featured ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!quote.trim()) {
      setError("A quote is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      quote: quote.trim(),
      clientName: clientName.trim() || undefined,
      clientTitle: clientTitle.trim() || undefined,
      organization: organization.trim() || undefined,
      location: location.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
      active,
      featured,
    };
    try {
      if (testimonial) await updateTestimonial(testimonial.id, body);
      else await createTestimonial(body);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the testimonial.");
      setBusy(false);
    }
  };

  return (
    <Modal title={testimonial ? "Edit testimonial" : "New testimonial"} onClose={onClose} size="lg">
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-3">
        <MField label="Quote" required><textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={3} className={inputCls} /></MField>
        <div className="grid gap-3 sm:grid-cols-2">
          <MField label="Client name" description="Optional — leave blank for an anonymous testimonial."><input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} /></MField>
          <MField label="Client title"><input value={clientTitle} onChange={(e) => setClientTitle(e.target.value)} className={inputCls} /></MField>
          <MField label="Organization"><input value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputCls} /></MField>
          <MField label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} /></MField>
          <MField label="Sort order"><input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} /></MField>
        </div>
        <MField label="Internal notes" description="Nonnis-only. Never shown on the public website.">
          <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} className={inputCls} />
        </MField>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" /> Active
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded border-slate-300" /> Featured
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy || !quote.trim()} onClick={() => void submit()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save testimonial"}</button>
      </div>
    </Modal>
  );
}

function MField({ label, required, description, children }: { label: string; required?: boolean; description?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}{required ? <span className="ml-0.5 text-rose-600">*</span> : null}</span>
      {description ? <span className="mt-0.5 block text-xs text-slate-400">{description}</span> : null}
      {children}
    </label>
  );
}
