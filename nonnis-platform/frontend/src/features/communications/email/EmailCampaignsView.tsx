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
import { cancelCampaign, listCampaigns } from "@/services/communications-email.service";
import type { CampaignStatus, EmailCampaignSummary } from "@/types/communications-email";
import { MockModeBanner } from "./MockModeBanner";
import { campaignStatusTone } from "./status-tones";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const CANCELLABLE: CampaignStatus[] = ["QUEUED", "SENDING"];

export function EmailCampaignsView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, status]);
  const filters = useMemo(() => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined }), [page, debounced, status]);
  const { data, loading, error, reload } = useAsync(() => listCampaigns(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<EmailCampaignSummary>[] = [
    { key: "name", header: "Campaign", render: (c) => <Link href={`/communications/email-campaigns/${c.id}`} className="font-medium text-brand-800 hover:underline">{c.name}</Link> },
    { key: "status", header: "Status", render: (c) => <StatusBadge label={c.status.replace(/_/g, " ").toLowerCase()} tone={campaignStatusTone(c.status)} /> },
    { key: "subject", header: "Subject", render: (c) => c.subject ?? <span className="text-slate-400">—</span> },
    { key: "eligible", header: "Eligible", align: "right", render: (c) => c.eligibleRecipientCount },
    { key: "excluded", header: "Excluded", align: "right", render: (c) => c.excludedRecipientCount },
    { key: "created", header: "Created", render: (c) => formatDate(c.createdAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          <Link href={`/communications/email-campaigns/${c.id}`} className="text-sm text-brand-700 hover:underline">View</Link>
          {CANCELLABLE.includes(c.status) ? (
            <MutationButton variant="danger-link" action={() => cancelCampaign(c.id)} confirm={{ title: "Cancel campaign?", description: "Recipients not yet sent will be cancelled. Emails already sent cannot be recalled.", confirmLabel: "Cancel campaign", variant: "danger" }} successToast="Campaign cancelled" onSuccess={reload}>Cancel</MutationButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Email Campaigns" description="Send a template to opted-in contacts. Recipients are snapshotted and tracked individually." actions={<button type="button" onClick={() => router.push("/communications/email-campaigns/new")} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" aria-hidden /> New campaign</button>} />
      <MockModeBanner />
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Campaign name…" className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {["DRAFT", "QUEUED", "SENDING", "COMPLETED", "PARTIALLY_FAILED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </label>
        </div>
      </Panel>
      <Panel title="Campaigns" description={data ? `${data.total} campaign${data.total === 1 ? "" : "s"}` : undefined}>
        {loading ? <LoadingState label="Loading campaigns…" /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No campaigns yet" message="Create a campaign to send an email template to your contacts." />
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
