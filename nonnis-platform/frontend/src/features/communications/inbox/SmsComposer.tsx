"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { calculateSegments, MAX_SMS_BODY_CHARS } from "@/lib/sms-segments";
import { replyToConversation } from "@/services/communications-inbox.service";

/**
 * SMS reply composer — plain text only (no rich-text toolbar, no attachments).
 * Shows a live character / encoding / segment estimate; the backend re-counts
 * authoritatively when the message is queued.
 */
export function SmsComposer({ conversationId, disabled, disabledReason, onSent }: { conversationId: string; disabled?: boolean; disabledReason?: string; onSent: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const info = useMemo(() => calculateSegments(body), [body]);
  const tooLong = body.length > MAX_SMS_BODY_CHARS;

  const send = async () => {
    if (sending || !body.trim() || tooLong) return;
    setSending(true);
    try {
      await replyToConversation(conversationId, body.trim(), []);
      setBody("");
      toast.success("SMS reply queued");
      onSent();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Unable to send SMS.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  if (disabled) {
    return <div className="border-t border-sage bg-ivory px-4 py-3 text-sm text-slate-500">{disabledReason ?? "Replying is not available for this conversation."}</div>;
  }

  return (
    <div className="border-t border-sage bg-white p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Write an SMS reply…"
        className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          <strong className={tooLong ? "text-rose-600" : "text-umber"}>{body.length}</strong>
          <span className="text-slate-400"> chars · {info.encoding === "GSM7" ? "GSM-7" : "UCS-2"} · est. {info.segmentCount} segment{info.segmentCount === 1 ? "" : "s"}</span>
        </span>
        <button type="button" onClick={() => void send()} disabled={sending || !body.trim() || tooLong} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} {sending ? "Sending…" : "Send SMS"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Sends from the configured Nonni&apos;s number to this contact only.</p>
    </div>
  );
}
