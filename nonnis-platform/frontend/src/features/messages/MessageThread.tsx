"use client";

import { useState } from "react";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import type { PaginatedResult } from "@/types/api";
import type { MessageView } from "@/types/messages";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Reusable case-linked message thread. Append-only: shows structured message
 * rows (sender, time, body) and a plain-text composer. Reused for case-team,
 * Nonnis internal notes, and provider-referral conversations.
 */
export function MessageThread({
  load,
  send,
  canSend,
  emptyLabel = "No messages yet.",
  placeholder = "Write a message…",
}: {
  load: () => Promise<PaginatedResult<MessageView>>;
  send: (body: string) => Promise<MessageView>;
  canSend: boolean;
  emptyLabel?: string;
  placeholder?: string;
}) {
  const { data, loading, error, reload } = useAsync(load, []);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setSendError(null);
    try {
      await send(body.trim());
      setBody("");
      reload();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not send the message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <LoadingState label="Loading messages…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No messages" message={emptyLabel} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="rounded-md border border-sage/70 bg-cream/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-umber">{m.sender.name ?? "Unknown"}</span>
                <span className="text-xs text-slate-400">{formatDateTime(m.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
              {m.scope === "PROVIDER_REFERRAL" ? (
                <span className="mt-1 inline-block text-[0.68rem] uppercase tracking-wide text-slate-400">{humanizeEnum(m.scope)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canSend ? (
        <div>
          {sendError ? <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p> : null}
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} className={inputCls} aria-label="Message" />
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => void submit()} disabled={busy || !body.trim()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
