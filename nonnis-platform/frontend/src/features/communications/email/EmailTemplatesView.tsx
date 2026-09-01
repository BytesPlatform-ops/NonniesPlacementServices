"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { archiveTemplate, duplicateTemplate, listTemplates } from "@/services/communications-email.service";
import type { EmailTemplateSummary } from "@/types/communications-email";
import { MockModeBanner } from "./MockModeBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function EmailTemplatesView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, status]);

  const filters = useMemo(() => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined }), [page, debounced, status]);
  const { data, loading, error, reload } = useAsync(() => listTemplates(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<EmailTemplateSummary>[] = [
    { key: "name", header: "Template", render: (t) => <Link href={`/communications/email-templates/${t.id}`} className="font-medium text-brand-800 hover:underline">{t.name}</Link> },
    { key: "status", header: "Status", render: (t) => <StatusBadge label={t.status.toLowerCase()} tone={t.status === "ARCHIVED" ? "neutral" : t.status === "ACTIVE" ? "positive" : "info"} /> },
    { key: "subject", header: "Default subject", render: (t) => t.subjectDefault ?? <span className="text-slate-400">—</span> },
    { key: "updated", header: "Updated", render: (t) => formatDate(t.updatedAt) },
    { key: "by", header: "Updated by", render: (t) => t.updatedByName ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          <Link href={`/communications/email-templates/${t.id}`} className="text-sm text-brand-700 hover:underline">Edit</Link>
          <MutationButton variant="link" action={() => duplicateTemplate(t.id)} successToast="Template duplicated" onSuccess={reload}>Duplicate</MutationButton>
          {t.status !== "ARCHIVED" ? (
            <MutationButton variant="danger-link" action={() => archiveTemplate(t.id)} confirm={{ title: "Archive template?", description: "Archived templates can't be used for new campaigns. Existing campaign history is preserved.", confirmLabel: "Archive", variant: "danger" }} successToast="Template archived" onSuccess={reload}>Archive</MutationButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Email Templates"
        description="Reusable, brand-consistent email designs. The builder owns the HTML — no raw HTML editing."
        actions={<button type="button" onClick={() => router.push("/communications/email-templates/new")} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" aria-hidden /> New template</button>}
      />
      <MockModeBanner />
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Template name…" className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Active &amp; draft</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
        </div>
      </Panel>
      <Panel title="Templates" description={data ? `${data.total} template${data.total === 1 ? "" : "s"}` : undefined}>
        {loading ? <LoadingState label="Loading templates…" /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No templates yet" message="Create your first email template to start building campaigns." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
