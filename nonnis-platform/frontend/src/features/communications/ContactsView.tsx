"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { archiveContact, getContactCounts, listContacts, listLists, listTags, type ContactFilters } from "@/services/communications.service";
import type { ContactView } from "@/types/communications";
import { channelConsent, contactName, contactStatusTone } from "./labels";
import { ContactForm } from "./ContactForm";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const CONSENT_OPTS = [
  { value: "", label: "Any consent" },
  { value: "OPTED_IN", label: "Opted in" },
  { value: "UNKNOWN", label: "Unknown" },
  { value: "OPTED_OUT", label: "Opted out" },
];

export function ContactsView() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [toggles, setToggles] = useState({ hasEmail: false, hasPhone: false });
  const [emailConsent, setEmailConsent] = useState("");
  const [smsConsent, setSmsConsent] = useState("");
  const [listId, setListId] = useState("");
  const [tagId, setTagId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ContactView | null>(null);

  const counts = useAsync(() => getContactCounts(), []);
  const lists = useAsync(() => listLists({ activeOnly: true, pageSize: 100 }), []);
  const tags = useAsync(() => listTags(), []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, toggles, emailConsent, smsConsent, listId, tagId]);

  const filters: ContactFilters = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: debounced || undefined,
      status,
      hasEmail: toggles.hasEmail || undefined,
      hasPhone: toggles.hasPhone || undefined,
      emailConsent: emailConsent || undefined,
      smsConsent: smsConsent || undefined,
      listId: listId || undefined,
      tagId: tagId || undefined,
    }),
    [page, debounced, status, toggles, emailConsent, smsConsent, listId, tagId],
  );
  const { data, loading, error, reload } = useAsync(() => listContacts(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const refreshAll = () => {
    reload();
    counts.reload();
  };

  const columns: Column<ContactView>[] = [
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <div>
          <Link href={`/communications/contacts/${c.id}`} className="font-medium text-brand-800 hover:underline">
            {contactName(c)}
          </Link>
          {c.organizationName ? <p className="text-xs text-slate-500">{c.organizationName}</p> : null}
        </div>
      ),
    },
    { key: "email", header: "Email", render: (c) => c.email ?? <span className="text-slate-400">—</span> },
    { key: "phone", header: "Phone", render: (c) => c.phone ?? <span className="text-slate-400">—</span> },
    {
      key: "econsent",
      header: "Email consent",
      render: (c) => {
        const m = channelConsent(c.hasEmail, c.emailConsent, c.emailSuppressed);
        return <StatusBadge label={m.label} tone={m.tone} />;
      },
    },
    {
      key: "sconsent",
      header: "SMS consent",
      render: (c) => {
        const m = channelConsent(c.hasPhone, c.smsConsent, c.smsSuppressed);
        return <StatusBadge label={m.label} tone={m.tone} />;
      },
    },
    { key: "lists", header: "Lists / tags", render: (c) => <span className="text-xs text-slate-500">{[c.lists.length ? `${c.lists.length} list${c.lists.length === 1 ? "" : "s"}` : null, c.tags.length ? `${c.tags.length} tag${c.tags.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "status", header: "Status", render: (c) => <StatusBadge label={c.status === "ARCHIVED" ? "Archived" : "Active"} tone={contactStatusTone(c.status)} /> },
    { key: "updated", header: "Updated", render: (c) => formatDate(c.updatedAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          <button type="button" onClick={() => setEditing(c)} className="text-sm text-slate-500 hover:text-umber">Edit</button>
          {c.status === "ACTIVE" ? (
            <MutationButton
              variant="danger-link"
              action={() => archiveContact(c.id)}
              confirm={{ title: "Archive contact?", description: "The contact is hidden from active lists but its future history is preserved. You can still see it with the Archived filter.", confirmLabel: "Archive", variant: "danger" }}
              successToast="Contact archived"
              onSuccess={refreshAll}
            >
              Archive
            </MutationButton>
          ) : null}
        </div>
      ),
    },
  ];

  const metric = (label: string, value: number | undefined) => (
    <div className="rounded-lg border border-sage bg-ivory px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-umber">{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeading
        title="Contacts"
        description="Your marketing/outreach contact database. Separate from patients and cases."
        actions={
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden /> New contact
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metric("Active contacts", counts.data?.totalActive)}
        {metric("Email contacts", counts.data?.emailContacts)}
        {metric("SMS contacts", counts.data?.smsContacts)}
        {metric("Suppressed", counts.data?.suppressed)}
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone, org…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Email consent</span>
            <select value={emailConsent} onChange={(e) => setEmailConsent(e.target.value)} className={`${inputCls} bg-white`}>
              {CONSENT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">SMS consent</span>
            <select value={smsConsent} onChange={(e) => setSmsConsent(e.target.value)} className={`${inputCls} bg-white`}>
              {CONSENT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">List</span>
            <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any list</option>
              {(lists.data?.items ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Tag</span>
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any tag</option>
              {(tags.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["hasEmail", "hasPhone"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setToggles((p) => ({ ...p, [k]: !p[k] }))}
              aria-pressed={toggles[k]}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", toggles[k] ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}
            >
              {k === "hasEmail" ? "Has email" : "Has phone"}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Contacts" description={data ? `${data.total} contact${data.total === 1 ? "" : "s"}` : undefined}>
        {loading ? (
          <LoadingState label="Loading contacts…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No contacts" message="No contacts match the current filters. Create one or import a list." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      {creating ? <ContactForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refreshAll(); }} /> : null}
      {editing ? <ContactForm contact={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refreshAll(); }} /> : null}
    </div>
  );
}
