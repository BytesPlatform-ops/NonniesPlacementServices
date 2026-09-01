"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { cancelCampaign, getCampaign, listRecipients, queueCampaign } from "@/services/communications-email.service";
import type { CampaignStatus, EmailRecipientView } from "@/types/communications-email";
import { campaignStatusTone, recipientStatusTone } from "./status-tones";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const CANCELLABLE: CampaignStatus[] = ["QUEUED", "SENDING"];
const LIVE: CampaignStatus[] = ["QUEUED", "SENDING"];

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const { data, loading, error, reload } = useAsync(() => getCampaign(campaignId), [campaignId]);
  const [rStatus, setRStatus] = useState("");
  const [rSearch, setRSearch] = useState("");
  const [rDebounced, setRDebounced] = useState("");
  const [rPage, setRPage] = useState(1);
  const [showEmail, setShowEmail] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRDebounced(rSearch), 300); return () => clearTimeout(t); }, [rSearch]);
  useEffect(() => setRPage(1), [rStatus, rDebounced]);

  const rFilters = useMemo(() => ({ page: rPage, pageSize: 20, status: rStatus || undefined, search: rDebounced || undefined }), [rPage, rStatus, rDebounced]);
  const recipients = useAsync(() => listRecipients(campaignId, rFilters), [campaignId, rFilters]);

  // Live refresh while the campaign is queued/sending.
  useEffect(() => {
    if (!data || !LIVE.includes(data.status)) return;
    const id = setInterval(() => { reload(); recipients.reload(); }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status]);

  if (loading) return <LoadingState label="Loading campaign…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const c = data;
  const counts = c.counts;

  const back = <Link href="/communications/email-campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden /> Campaigns</Link>;

  const columns: Column<EmailRecipientView>[] = [
    { key: "contact", header: "Contact", render: (r) => <div><Link href={`/communications/contacts/${r.contactId}`} className="text-brand-800 hover:underline">{r.name ?? r.email}</Link>{r.organization ? <p className="text-xs text-slate-500">{r.organization}</p> : null}</div> },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "status", header: "Status", render: (r) => <StatusBadge label={r.deliveryStatus.replace(/_/g, " ").toLowerCase()} tone={recipientStatusTone(r.deliveryStatus)} /> },
    { key: "sent", header: "Sent", render: (r) => (r.sentAt ? formatDateTime(r.sentAt) : "—") },
    { key: "reason", header: "Reason", render: (r) => <span className="text-xs text-slate-500">{r.exclusionReason ?? r.errorMessage ?? "—"}</span> },
  ];

  const metric = (label: string, value: number, tone?: string) => (
    <div className="rounded-lg border border-sage bg-ivory px-3 py-2 text-center shadow-card"><p className={`text-xl font-semibold tabular-nums ${tone ?? "text-umber"}`}>{value}</p><p className="text-xs text-slate-500">{label}</p></div>
  );

  return (
    <div className="space-y-4">
      <PageHeading
        title={c.name}
        description={c.subject ?? undefined}
        breadcrumb={back}
        actions={
          <div className="flex items-center gap-2">
            {c.htmlSnapshot ? <button type="button" onClick={() => setShowEmail(true)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View email</button> : null}
            {c.status === "DRAFT" ? <MutationButton variant="primary" action={() => queueCampaign(c.id)} confirm={{ title: "Send this campaign?", description: "It will be queued for its eligible recipients.", confirmLabel: "Queue" }} successToast="Campaign queued" onSuccess={reload}>Queue</MutationButton> : null}
            {CANCELLABLE.includes(c.status) ? <MutationButton variant="danger" action={() => cancelCampaign(c.id)} confirm={{ title: "Cancel campaign?", description: "Recipients not yet sent will be cancelled. Emails already sent cannot be recalled.", confirmLabel: "Cancel campaign", variant: "danger" }} successToast="Campaign cancelled" onSuccess={reload}>Cancel</MutationButton> : null}
            <StatusBadge label={c.status.replace(/_/g, " ").toLowerCase()} tone={campaignStatusTone(c.status)} />
          </div>
        }
      />

      <Panel title="Overview">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><p className="text-xs text-slate-500">Sender</p><p className="text-slate-700">{c.senderName} · {c.senderEmail}</p></div>
          <div><p className="text-xs text-slate-500">Eligible</p><p className="text-slate-700">{c.eligibleRecipientCount}</p></div>
          <div><p className="text-xs text-slate-500">Excluded</p><p className="text-slate-700">{c.excludedRecipientCount}</p></div>
          <div><p className="text-xs text-slate-500">Queued</p><p className="text-slate-700">{c.queuedAt ? formatDateTime(c.queuedAt) : "—"}</p></div>
        </div>
      </Panel>

      {counts ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {metric("Queued", counts.queued, "text-indigo-700")}
          {metric("Processing", counts.processing, "text-indigo-700")}
          {metric("Sent", counts.sent, "text-emerald-700")}
          {metric("Delivered", counts.delivered, "text-emerald-700")}
          {metric("Bounced", counts.bounced, "text-rose-700")}
          {metric("Failed", counts.failed, "text-rose-700")}
          {metric("Unsubscribed", counts.unsubscribed, "text-amber-700")}
          {metric("Unknown", counts.deliveryUnknown, "text-amber-700")}
        </div>
      ) : null}

      <Panel title="Recipients" description={recipients.data ? `${recipients.data.total} recipient${recipients.data.total === 1 ? "" : "s"}` : undefined}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={rSearch} onChange={(e) => setRSearch(e.target.value)} placeholder="Name or email…" className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Status</span>
            <select value={rStatus} onChange={(e) => setRStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any</option>
              {["QUEUED", "PROCESSING", "SENT", "DELIVERED", "BOUNCED", "FAILED", "UNSUBSCRIBED", "CANCELLED", "DELIVERY_UNKNOWN", "EXCLUDED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </label>
        </div>
        {recipients.loading ? <LoadingState label="Loading recipients…" /> : !recipients.data || recipients.data.items.length === 0 ? (
          <EmptyState title="No recipients" message="No recipients match the current filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={recipients.data.items} getRowKey={(r) => r.id} />
            {recipients.data.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Page {rPage} of {recipients.data.totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={rPage <= 1} onClick={() => setRPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={rPage >= recipients.data.totalPages} onClick={() => setRPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      {showEmail && c.htmlSnapshot ? (
        <Modal title="Campaign email" onClose={() => setShowEmail(false)} size="lg">
          <iframe title="Campaign email" sandbox="" srcDoc={c.htmlSnapshot} className="h-[60vh] w-full rounded-md border border-sage bg-white" />
        </Modal>
      ) : null}
    </div>
  );
}
