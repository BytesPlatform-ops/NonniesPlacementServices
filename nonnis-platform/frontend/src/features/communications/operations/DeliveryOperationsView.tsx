"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mail, MessageSquare, RotateCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { listDeliveryFailures, retryDelivery } from "@/services/communications-operations.service";
import type { DeliveryFailureView } from "@/types/communications-operations";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const SOURCE_LABEL: Record<string, string> = {
  EMAIL_CAMPAIGN: "Email campaign",
  EMAIL_REPLY: "Email reply",
  SMS_CAMPAIGN: "SMS campaign",
  SMS_REPLY: "SMS reply",
};

function statusTone(status: string) {
  if (status === "DELIVERY_UNKNOWN") return "warning" as const;
  return "negative" as const;
}
function statusLabel(status: string) {
  return status === "DELIVERY_UNKNOWN" ? "delivery uncertain" : status.replace(/_/g, " ").toLowerCase();
}

export function DeliveryOperationsView() {
  const { hasPermission } = useAuth();
  const canSend = hasPermission(PERMISSIONS.COMMUNICATIONS_SEND);
  const toast = useToast();
  const confirm = useConfirm();

  const [channel, setChannel] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [channel, source, status]);

  const filters = useMemo(() => ({ channel: channel || undefined, source: source || undefined, status: status || undefined, page, pageSize: 25 }), [channel, source, status, page]);
  const { data, loading, error, reload } = useAsync(() => listDeliveryFailures(filters), [filters]);

  const runRetry = async (row: DeliveryFailureView) => {
    if (!row.retry.allowed) return;
    if (row.retry.requiresConfirmation) {
      const ok = await confirm({
        title: "Re-send a message that may already have been delivered?",
        description: `${row.retry.reason} If it was delivered, ${row.recipient ?? "the recipient"} will receive it twice. Only continue if a duplicate is acceptable.`,
        confirmLabel: "Re-send anyway",
        variant: "danger",
      });
      if (!ok) return;
    }
    try {
      await retryDelivery(row.id, row.source, row.retry.requiresConfirmation);
      toast.success("Queued for another attempt");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not retry this delivery.");
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Delivery Operations"
        description="Email and SMS that need a human. Delivered messages are never listed here."
      />

      <Panel title="Failures needing attention" description={data ? `${data.total} item${data.total === 1 ? "" : "s"}` : undefined}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">All channels</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
          </label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Type</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Campaigns &amp; replies</option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any</option>
              {["FAILED", "DELIVERY_UNKNOWN", "BOUNCED", "UNDELIVERED"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading delivery failures…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing needs attention" message="No email or SMS deliveries are currently failed or uncertain." />
        ) : (
          <>
            <ul className="divide-y divide-sage/70">
              {items.map((row) => (
                <li key={`${row.source}:${row.id}`} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.channel === "SMS" ? <MessageSquare className="h-4 w-4 shrink-0 text-teal-600" aria-hidden /> : <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                    <span className="text-sm font-medium text-umber">{row.contactName ?? row.recipient ?? "Unknown recipient"}</span>
                    <span className="text-xs text-slate-400">{row.recipient}</span>
                    <StatusBadge label={statusLabel(row.status)} tone={statusTone(row.status)} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{SOURCE_LABEL[row.source]}</span>
                    <span className="ml-auto text-xs text-slate-400">{row.occurredAt ? formatDateTime(row.occurredAt) : ""}</span>
                  </div>

                  <p className="mt-1 text-xs text-slate-600">
                    {row.errorMessage ?? "No provider detail recorded."}
                    {row.errorCode ? <span className="ml-1 text-slate-400">({row.errorCode})</span> : null}
                    {row.attemptCount > 0 ? <span className="ml-1 text-slate-400">· {row.attemptCount} attempt{row.attemptCount === 1 ? "" : "s"}</span> : null}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {row.contextId && row.source.endsWith("CAMPAIGN") ? (
                      <Link href={`/communications/${row.channel === "SMS" ? "sms" : "email"}-campaigns/${row.contextId}`} className="text-xs text-brand-700 hover:underline">
                        {row.contextName ?? "View campaign"}
                      </Link>
                    ) : row.contextId ? (
                      <Link href={`/communications/inbox?c=${row.contextId}`} className="text-xs text-brand-700 hover:underline">Open conversation</Link>
                    ) : null}

                    {canSend && row.retry.allowed ? (
                      <button
                        type="button"
                        onClick={() => void runRetry(row)}
                        className={`inline-flex items-center gap-1 text-xs font-medium ${row.retry.requiresConfirmation ? "text-amber-700 hover:underline" : "text-brand-700 hover:underline"}`}
                      >
                        <RotateCw className="h-3.5 w-3.5" aria-hidden />
                        {row.retry.requiresConfirmation ? "Re-send (may duplicate)" : "Retry"}
                      </button>
                    ) : (
                      <span className="inline-flex items-start gap-1 text-xs text-slate-500">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        {row.retry.reason}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {data!.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Page {page} of {data!.totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={page >= data!.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
