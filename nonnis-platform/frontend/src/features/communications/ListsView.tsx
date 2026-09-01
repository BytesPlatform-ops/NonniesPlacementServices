"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { addListMembers, createList, listContacts, listLists, listMembers, removeListMember, updateList } from "@/services/communications.service";
import type { ContactView, ListView } from "@/types/communications";
import { contactName } from "./labels";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function ListsView() {
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<ListView | null>(null);
  const { data, loading, error, reload } = useAsync(() => listLists({ pageSize: 100 }), []);

  const columns: Column<ListView>[] = [
    { key: "name", header: "List", render: (l) => <button type="button" onClick={() => setMembers(l)} className="font-medium text-brand-800 hover:underline">{l.name}</button> },
    { key: "desc", header: "Description", render: (l) => <span className="text-slate-600">{l.description ?? "—"}</span> },
    { key: "count", header: "Members", align: "right", render: (l) => l.memberCount },
    { key: "status", header: "Status", render: (l) => <StatusBadge label={l.active ? "Active" : "Archived"} tone={l.active ? "positive" : "neutral"} /> },
    { key: "updated", header: "Updated", render: (l) => formatDate(l.updatedAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          <button type="button" onClick={() => setMembers(l)} className="text-sm text-brand-700 hover:underline">Members</button>
          <MutationButton
            variant={l.active ? "danger-link" : "link"}
            action={() => updateList(l.id, { active: !l.active })}
            confirm={l.active ? { title: "Archive list?", description: "The list is deactivated; its membership history is preserved.", confirmLabel: "Archive", variant: "danger" } : undefined}
            successToast={l.active ? "List archived" : "List reactivated"}
            onSuccess={reload}
          >
            {l.active ? "Archive" : "Activate"}
          </MutationButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Contact lists"
        description="Reusable audiences. One contact can belong to many lists."
        actions={<button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" aria-hidden /> New list</button>}
      />
      <Panel title="Lists" description={data ? `${data.total} list${data.total === 1 ? "" : "s"}` : undefined}>
        {loading ? <LoadingState label="Loading lists…" /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No lists yet" message="Create a list to group contacts for future campaigns." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
        )}
      </Panel>

      {creating ? <CreateListModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} /> : null}
      {members ? <MembersModal list={members} onClose={() => { setMembers(null); reload(); }} /> : null}
    </div>
  );
}

function CreateListModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      await createList({ name: name.trim(), description: description.trim() || undefined });
      toast.success("List created");
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not create the list."); setBusy(false); }
  };
  return (
    <Modal title="New list" onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <label className="block"><span className="text-xs font-medium text-slate-600">Name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
      <label className="mt-3 block"><span className="text-xs font-medium text-slate-600">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Creating…" : "Create list"}</button>
      </div>
    </Modal>
  );
}

function MembersModal({ list, onClose }: { list: ListView; onClose: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const members = useAsync(() => listMembers(list.id, { page, pageSize: 10 }), [list.id, page, nonce]);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  const searchFilters = useMemo(() => ({ page: 1, pageSize: 8, search: debounced || undefined, status: "ACTIVE" }), [debounced]);
  const results = useAsync(() => (debounced ? listContacts(searchFilters) : Promise.resolve(null)), [searchFilters]);

  const add = async (c: ContactView) => {
    try { await addListMembers(list.id, [c.id]); toast.success("Added to list"); setNonce((n) => n + 1); } catch { toast.error("Could not add contact"); }
  };
  const remove = async (c: ContactView) => {
    await removeListMember(list.id, c.id); setNonce((n) => n + 1);
  };

  return (
    <Modal title={`Members · ${list.name}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block"><span className="text-xs font-medium text-slate-600">Add contacts</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts to add…" className={inputCls} />
          </label>
          {debounced ? (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-sage">
              {results.loading ? <p className="p-3 text-sm text-slate-500">Searching…</p> : (results.data?.items ?? []).length === 0 ? <p className="p-3 text-sm text-slate-400">No matching contacts.</p> : (
                <ul className="divide-y divide-slate-100">
                  {(results.data?.items ?? []).map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{contactName(c)} <span className="text-slate-400">{c.email ?? c.phone}</span></span>
                      <button type="button" onClick={() => void add(c)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-slate-50">Add</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600">Current members {members.data ? `(${members.data.total})` : ""}</p>
          {members.loading ? <LoadingState label="Loading members…" /> : !members.data || members.data.items.length === 0 ? (
            <EmptyState title="No members" message="Search above to add contacts to this list." />
          ) : (
            <>
              <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-sage">
                {members.data.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{contactName(c)} <span className="text-slate-400">{c.email ?? c.phone}</span></span>
                    <MutationButton variant="danger-link" action={() => remove(c)} successToast="Removed from list">Remove</MutationButton>
                  </li>
                ))}
              </ul>
              {members.data.totalPages > 1 ? (
                <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-500">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {page} of {members.data.totalPages}</span>
                  <button type="button" disabled={page >= members.data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
