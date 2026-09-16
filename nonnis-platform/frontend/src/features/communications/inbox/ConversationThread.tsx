"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore, Info, Loader2, MailOpen, Megaphone, Ban } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { archiveConversation, getConversation, listThreadMessages, markUnread, restoreConversation } from "@/services/communications-inbox.service";
import type { MessageView } from "@/types/communications-inbox";
import { dayKey, dayLabel } from "./inbox-format";
import { ConversationDetailsPanel } from "./ConversationDetailsPanel";
import { MessageBubble } from "./MessageBubble";
import { ReplyComposer } from "./ReplyComposer";
import { SmsComposer } from "./SmsComposer";

const POLL_MS = 20_000;

export function ConversationThread({ conversationId, onMutated, onBack }: { conversationId: string; onMutated: () => void; onBack?: () => void }) {
  const { hasPermission } = useAuth();
  const canReply = hasPermission(PERMISSIONS.COMMUNICATIONS_SEND);
  const canManage = hasPermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const { data, loading, error, reload } = useAsync(() => getConversation(conversationId), [conversationId]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  // Pages fetched by scrolling up, kept oldest-first ahead of the server page.
  const [older, setOlder] = useState<MessageView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // A different conversation starts from a clean history.
  useEffect(() => { setOlder([]); setLoadingOlder(false); }, [conversationId]);
  useEffect(() => { if (data) setHasMore(data.hasMoreMessages); }, [data]);

  const loadOlder = useCallback(async () => {
    const oldest = older[0] ?? data?.messages[0];
    if (!oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    // Anchor on distance from the BOTTOM: prepending rows changes scrollHeight,
    // and restoring that distance keeps the reader exactly where they were.
    const anchor = el ? el.scrollHeight - el.scrollTop : 0;
    try {
      const page = await listThreadMessages(conversationId, oldest.id);
      setOlder((prev) => [...page.items, ...prev]);
      setHasMore(page.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - anchor; });
    } catch {
      // Leave hasMore set so the reader can try again by scrolling.
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, data?.messages, older, loadingOlder, hasMore]);

  // Light polling; the composer keeps its own state so a refresh never loses a draft.
  useEffect(() => {
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload, conversationId]);

  // Jump to the newest message when the server page grows — but never when older
  // history is prepended, which must leave the scroll position untouched.
  useEffect(() => {
    const count = data?.messages.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [data?.messages.length]);

  // Opening a conversation marks it read for this user — refresh the list badge once.
  useEffect(() => {
    onMutated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  if (loading && !data) return <LoadingState label="Loading conversation…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const c = data;
  const isSms = c.channel === "SMS";
  // Older pages sit ahead of the server page; both are already oldest-first.
  const thread = older.length ? [...older, ...c.messages] : c.messages;
  const afterMutation = () => { reload(); onMutated(); };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-sage bg-white px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} className="lg:hidden -ml-1 mt-0.5 text-slate-500 hover:text-umber" aria-label="Back to inbox"><ArrowLeft className="h-5 w-5" aria-hidden /></button> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-umber">{c.contact.name ?? (isSms ? c.contact.phone : c.contact.email) ?? "Unknown contact"}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSms ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"}`}>{isSms ? "SMS" : "Email"}</span>
            {c.needsReply ? <StatusBadge label="needs reply" tone="warning" /> : null}
            {c.status === "ARCHIVED" ? <StatusBadge label="archived" tone="neutral" /> : null}
          </div>
          <p className="truncate text-sm text-slate-500">{isSms ? (c.contact.phone ?? "SMS conversation") : (c.subject ?? "(no subject)")}</p>
          <p className="truncate text-xs text-slate-400">{isSms ? (c.businessNumber ? `via ${c.businessNumber}` : "") : c.contact.email}{c.contact.organization ? `${isSms && !c.businessNumber ? "" : " · "}${c.contact.organization}` : ""}</p>
          {c.originCampaignId ? (
            <Link href={`/communications/${isSms ? "sms" : "email"}-campaigns/${c.originCampaignId}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
              <Megaphone className="h-3.5 w-3.5" aria-hidden /> Started from {isSms ? "SMS " : ""}campaign: {c.originCampaignName ?? "view"}
            </Link>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setDetailsOpen(true)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 2xl:hidden" aria-label="Contact and conversation details">
            <Info className="h-4 w-4" aria-hidden />
          </button>
          <MutationButton variant="secondary" action={() => markUnread(conversationId)} successToast="Marked unread" onSuccess={afterMutation}>
            <span className="inline-flex items-center gap-1"><MailOpen className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Unread</span></span>
          </MutationButton>
          {canManage ? (
            c.status === "ARCHIVED" ? (
              <MutationButton variant="secondary" action={() => restoreConversation(conversationId)} successToast="Conversation restored" onSuccess={afterMutation}>
                <span className="inline-flex items-center gap-1"><ArchiveRestore className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Restore</span></span>
              </MutationButton>
            ) : (
              <MutationButton variant="secondary" action={() => archiveConversation(conversationId)} confirm={{ title: "Archive conversation?", description: "It leaves the default inbox. A new inbound reply reopens it automatically.", confirmLabel: "Archive" }} successToast="Conversation archived" onSuccess={afterMutation}>
                <span className="inline-flex items-center gap-1"><Archive className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Archive</span></span>
              </MutationButton>
            )
          ) : null}
        </div>
      </div>

      {/* Contact context strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-sage/70 bg-ivory px-4 py-1.5 text-xs text-slate-500">
        {isSms
          ? c.contact.smsConsent ? <span>SMS consent: <strong className="text-slate-600">{c.contact.smsConsent.replace(/_/g, " ").toLowerCase()}</strong></span> : null
          : c.contact.emailConsent ? <span>Consent: <strong className="text-slate-600">{c.contact.emailConsent.replace(/_/g, " ").toLowerCase()}</strong></span> : null}
        {(isSms ? c.contact.smsSuppressed : c.contact.suppressed) ? <span className="inline-flex items-center gap-1 text-amber-700"><Ban className="h-3.5 w-3.5" aria-hidden /> {isSms ? "opted out — SMS blocked until they text START" : "suppressed (marketing)"}</span> : null}
        {c.contact.lists.length ? <span>Lists: {c.contact.lists.join(", ")}</span> : null}
        {c.contact.tags.length ? <span>Tags: {c.contact.tags.join(", ")}</span> : null}
        <Link href={`/communications/contacts/${c.contact.id}`} className="ml-auto text-brand-700 hover:underline">Open contact</Link>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => { if (e.currentTarget.scrollTop < 120) void loadOlder(); }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-cream px-4 py-4"
      >
        {hasMore ? (
          <div className="flex justify-center pb-1">
            <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="inline-flex items-center gap-1.5 rounded-full border border-sage bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-sage/20 disabled:opacity-60">
              {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}
            </button>
          </div>
        ) : thread.length > 0 ? (
          <p className="pb-1 text-center text-xs text-slate-400">Beginning of this conversation</p>
        ) : null}

        {thread.length === 0 ? (
          <p className="text-sm text-slate-400">No messages yet.</p>
        ) : (
          thread.map((m, i) => {
            const time = m.receivedAt ?? m.sentAt ?? m.createdAt;
            const newDay = i === 0 || dayKey(time) !== dayKey(thread[i - 1]!.receivedAt ?? thread[i - 1]!.sentAt ?? thread[i - 1]!.createdAt);
            return (
              <div key={m.id} className="space-y-3">
                {newDay ? (
                  <div className="flex items-center gap-3 pt-1" role="separator" aria-label={dayLabel(time)}>
                    <span className="h-px flex-1 bg-sage" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{dayLabel(time)}</span>
                    <span className="h-px flex-1 bg-sage" />
                  </div>
                ) : null}
                <MessageBubble message={m} conversationId={conversationId} onChanged={afterMutation} channel={c.channel} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer — plain-text SMS or rich email reply */}
      {isSms ? (
        <SmsComposer
          conversationId={conversationId}
          disabled={!canReply || !c.contact.phone || c.contact.smsSuppressed}
          disabledReason={
            !canReply
              ? "You do not have permission to send replies."
              : !c.contact.phone
                ? "This contact has no phone number."
                : c.contact.smsSuppressed
                  ? "This contact has opted out of SMS. They must text START before you can message them again."
                  : undefined
          }
          onSent={afterMutation}
        />
      ) : (
        <ReplyComposer
          conversationId={conversationId}
          disabled={!canReply || !c.contact.email}
          disabledReason={!canReply ? "You do not have permission to send replies." : !c.contact.email ? "This contact has no email address." : undefined}
          onSent={afterMutation}
        />
      )}
      </div>

      {/* Details: a third column on very wide screens, a drawer everywhere else. */}
      <div className="hidden w-[20rem] shrink-0 border-l border-sage 2xl:block">
        <ConversationDetailsPanel conversation={c} />
      </div>
      {detailsOpen ? (
        <div className="fixed inset-0 z-30 flex justify-end 2xl:hidden">
          <button type="button" className="absolute inset-0 bg-umber/30" aria-label="Close details" onClick={() => setDetailsOpen(false)} />
          <div className="relative h-full w-full max-w-sm border-l border-sage shadow-xl" role="dialog" aria-label="Conversation details">
            <ConversationDetailsPanel conversation={c} onClose={() => setDetailsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
