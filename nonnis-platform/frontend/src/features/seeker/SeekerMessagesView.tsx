"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listSeekerMessages, sendSeekerMessage } from "@/services/seeker.service";
import { useSeekerCaseId } from "./use-seeker-case";

/**
 * The family's thread with their care team.
 *
 * One thread per case, on the platform's existing case-message model. Internal
 * staff notes and provider correspondence live in other scopes the API never
 * serves here, so there is nothing to filter client-side.
 */
export function SeekerMessagesView() {
  const caseId = useSeekerCaseId();
  const { me } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const state = useAsync(() => listSeekerMessages({ caseId, pageSize: 100 }), [caseId]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendSeekerMessage(text, caseId);
      setBody("");
      state.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading title="Messages" description="Ask your care team anything about the placement." />

      <Panel>
        {state.loading ? (
          <LoadingState label="Loading messages…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No messages yet" message="Send the first message below — we usually reply the same day." />
        ) : (
          <ul className="space-y-3">
            {state.data?.items.map((m) => {
              const mine = m.sender.id === me?.user?.id;
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
                      mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800",
                    )}
                  >
                    <p className={cn("text-xs font-medium", mine ? "text-white/80" : "text-slate-500")}>
                      {mine ? "You" : (m.sender.name ?? "Your care team")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className={cn("mt-1.5 text-[0.68rem]", mine ? "text-white/70" : "text-slate-400")}>
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Send a message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Type your message…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || body.trim().length === 0}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </Panel>
    </div>
  );
}
