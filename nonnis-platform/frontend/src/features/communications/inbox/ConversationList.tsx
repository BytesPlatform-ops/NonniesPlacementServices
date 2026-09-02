"use client";

import { ArrowDownLeft, ArrowUpRight, Mail, Megaphone, MessageSquare } from "lucide-react";
import type { ConversationListItem } from "@/types/communications-inbox";
import { relativeTime } from "./inbox-format";

export function ConversationList({ items, selectedId, onSelect }: { items: ConversationListItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="divide-y divide-sage/70">
      {items.map((c) => {
        const active = c.id === selectedId;
        const isSms = c.channel === "SMS";
        const ChannelIcon = isSms ? MessageSquare : Mail;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-start gap-2 px-3 py-3 text-left transition-colors ${active ? "bg-brand-50" : "hover:bg-ivory"}`}
              aria-current={active ? "true" : undefined}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.unread ? "bg-brand-600" : "bg-transparent"}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <ChannelIcon className={`h-3.5 w-3.5 shrink-0 ${isSms ? "text-teal-600" : "text-slate-400"}`} aria-label={isSms ? "SMS conversation" : "Email conversation"} />
                  <span className={`truncate text-sm ${c.unread ? "font-semibold text-umber" : "font-medium text-slate-700"}`}>{c.contactName ?? (isSms ? c.contactPhone : c.contactEmail) ?? "Unknown"}</span>
                  {c.latestDirection === "INBOUND" ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Latest message received" /> : c.latestDirection === "OUTBOUND" ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-label="Latest message sent" /> : null}
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{relativeTime(c.lastMessageAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className={`truncate text-sm ${c.unread ? "text-slate-700" : "text-slate-500"}`}>{isSms ? (c.contactPhone ?? "SMS") : (c.subject ?? "(no subject)")}</span>
                  {c.needsReply ? <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">reply</span> : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className="truncate text-xs text-slate-400">{c.preview ?? (isSms ? c.contactPhone : c.contactEmail)}</span>
                </span>
                {c.originCampaignName ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400"><Megaphone className="h-3 w-3" aria-hidden /> {c.originCampaignName}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
