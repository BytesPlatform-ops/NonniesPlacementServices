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
import { listSmsCampaigns } from "@/services/communications-sms.service";
import type { SmsCampaignSummary } from "@/types/communications-sms";
import { smsCampaignTone } from "./sms-status";
import { SmsConfigBanner } from "./SmsConfigBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function SmsCampaignsView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, status]);

  const filters = useMemo(() => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined }), [page, debounced, status]);
  const { data, loading, error, reload } = useAsync(() => listSmsCampaigns(filters), [filters]);

  const columns: Column<SmsCampaignSummary>[] = [
    { key: "name", header: "Campaign", render: (c) => <Link href={`/communications/sms-campaigns/${c.id}`} className="font-medium text-brand-800 hover:underline">{c.name}</Link> },
    { key: "status", header: "Status", render: (c) => <StatusBadge label={c.status.replace(/_/g, " ").toLowerCase()} tone={smsCampaignTone(c.status)} /> },
    { key: "eligible", header: "Eligible", render: (c) => <span className="tabular-nums">{c.eligibleRecipientCount}</span> },
    { key: "excluded", header: "Excluded", render: (c) => <span className="tabular-nums text-slate-500">{c.excludedRecipientCount}</span> },
    { key: "segments", header: "Est. segments", render: (c) => <span className="tabular-nums">{c.estimatedSegmentCount}</span> },
    { key: "queued", header: "Queued", render: (c) => (c.queuedAt ? formatDateTime(c.queuedAt) : "—") },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="SMS Campaigns"
        description="Bulk SMS to opted-in contacts. Segment totals are estimates, not an invoice."
        actions={canManage ? <Link href="/communications/sms-campaigns/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" aria-hidden /> New campaign</Link> : undefined}
      />
      <SmsConfigBanner />
      <Panel title="Campaigns">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Campaign name…" className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any</option>
              {["DRAFT", "QUEUED", "SENDING", "COMPLETED", "PARTIALLY_FAILED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </label>
        </div>
        {loading && !data ? <LoadingState label="Loading campaigns…" /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No SMS campaigns" message="Create a campaign to message an opted-in contact list." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(c) => c.id} />
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
