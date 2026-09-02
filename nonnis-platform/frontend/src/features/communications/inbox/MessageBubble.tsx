"use client";

import { useState } from "react";
import { Paperclip, Download, AlertTriangle, RotateCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { downloadAttachment, retryReply } from "@/services/communications-inbox.service";
import type { MessageView } from "@/types/communications-inbox";
import { formatBytes, messageStatusLabel, messageStatusTone } from "./inbox-format";

const RETRYABLE = new Set(["FAILED", "DELIVERY_UNKNOWN"]);

export function MessageBubble({ message, conversationId, onChanged, channel = "EMAIL" }: { message: MessageView; conversationId: string; onChanged: () => void; channel?: "EMAIL" | "SMS" }) {
  const inbound = message.direction === "INBOUND";
  const isSms = channel === "SMS";
  const [showHtml, setShowHtml] = useState(false);
  const time = message.receivedAt ?? message.sentAt ?? message.createdAt;

  return (
    <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[42rem] rounded-2xl border px-4 py-3 shadow-card ${inbound ? "border-sage bg-white" : "border-brand-200 bg-brand-50"}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${inbound ? "bg-sage/40 text-umber" : "bg-brand-600 text-white"}`}>{inbound ? "Received" : "Sent"}</span>
          <span className="font-medium text-slate-600">{inbound ? message.fromName ?? message.fromAddress : message.toAddress}</span>
          {message.autoSubmitted ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">auto-reply</span> : null}
          {message.smsOptOutType ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">{message.smsOptOutType} keyword</span> : null}
          <span className="ml-auto">{formatDateTime(time)}</span>
        </div>

        {!isSms && message.subject ? <p className="mb-1 text-sm font-semibold text-umber">{message.subject}</p> : null}

        {!isSms && showHtml && message.htmlBody ? (
          <iframe title="Email content" sandbox="" srcDoc={message.htmlBody} className="h-72 w-full rounded-md border border-sage bg-white" />
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm text-slate-800">{message.textBody || message.preview || <span className="italic text-slate-400">No text content</span>}</div>
        )}
        {!isSms && message.htmlBody ? (
          <button type="button" onClick={() => setShowHtml((v) => !v)} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
            {showHtml ? "Show plain text" : "Show formatted"}
          </button>
        ) : null}

        {!isSms && message.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <button key={a.id} type="button" onClick={() => void downloadAttachment(conversationId, a.id)} className="inline-flex items-center gap-1.5 rounded-md border border-sage bg-ivory px-2 py-1 text-xs text-slate-700 hover:bg-white" title={`${a.mimeType} · ${formatBytes(a.sizeBytes)}`}>
                <Paperclip className="h-3.5 w-3.5" aria-hidden /> <span className="max-w-[12rem] truncate">{a.fileName}</span> <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}

        {!inbound ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={messageStatusLabel(message.status)} tone={messageStatusTone(message.status)} />
            {isSms && message.segmentCount ? (
              <span className="text-xs text-slate-400">{message.encoding === "GSM7" ? "GSM-7" : "UCS-2"} · {message.segmentCount} segment{message.segmentCount === 1 ? "" : "s"}</span>
            ) : null}
            {message.status === "FAILED" || message.status === "DELIVERY_UNKNOWN" ? (
              <span className="inline-flex items-center gap-1 text-xs text-rose-600"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {message.errorMessage ?? (message.status === "DELIVERY_UNKNOWN" ? "Delivery status uncertain" : "Send failed")}</span>
            ) : null}
            {RETRYABLE.has(message.status) ? (
              <MutationButton variant="link" action={() => retryReply(conversationId, message.id)} successToast="Reply re-queued" onSuccess={onChanged}>
                <span className="inline-flex items-center gap-1 text-xs"><RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry</span>
              </MutationButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
