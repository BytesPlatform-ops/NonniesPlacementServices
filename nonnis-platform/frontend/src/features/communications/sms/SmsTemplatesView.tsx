"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { listSmsTemplates } from "@/services/communications-sms.service";
import type { SmsTemplateSummary } from "@/types/communications-sms";
import { SmsConfigBanner } from "./SmsConfigBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function SmsTemplatesView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, status]);

  const filters = useMemo(() => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined }), [page, debounced, status]);
  const { data, loading, error, reload } = useAsync(() => listSmsTemplates(filters), [filters]);

  const columns: Column<SmsTemplateSummary>[] = [
    { key: "name", header: "Template", render: (t) => <Link href={`/communications/sms-templates/${t.id}`} className="font-medium text-brand-800 hover:underline">{t.name}</Link> },
    { key: "encoding", header: "Encoding", render: (t) => <span className="text-slate-600">{t.segments.encoding === "GSM7" ? "GSM-7" : "UCS-2"}</span> },
    { key: "segments", header: "Est. segments", render: (t) => <span className="tabular-nums">{t.segments.segmentCount}</span> },
    { key: "chars", header: "Characters", render: (t) => <span className="tabular-nums text-slate-500">{t.segments.characterCount}</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge label={t.status.toLowerCase()} tone={t.status === "ACTIVE" ? "positive" : "neutral"} /> },
    { key: "updated", header: "Updated", render: (t) => formatDateTime(t.updatedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="SMS Templates"
        description="Reusable plain-text messages with safe contact merge fields. Segment counts are estimates."
        actions={canManage ? <Link href="/communications/sms-templates/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" aria-hidden /> New template</Link> : undefined}
      />
      <SmsConfigBanner context="template" />
      <Panel title="Templates">
        <div className="mb-3 flex flex-wrap items-end gap-3">
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
        {loading && !data ? <LoadingState label="Loading templates…" /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No SMS templates" message="Create a template to reuse a message across campaigns." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(t) => t.id} />
            {data.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Page {page} of {data.totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
