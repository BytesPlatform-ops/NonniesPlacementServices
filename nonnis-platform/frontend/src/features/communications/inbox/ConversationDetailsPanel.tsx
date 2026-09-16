"use client";

import Link from "next/link";
import { Ban, ExternalLink, Megaphone, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StatusTone } from "@/lib/case-status";
import { formatDateTime } from "@/lib/format";
import type { ConversationDetail } from "@/types/communications-inbox";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-sage/60 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-700">{children}</dd>
    </div>
  );
}

const CONSENT_TONE: Record<string, StatusTone> = { OPTED_IN: "positive", OPTED_OUT: "negative", UNKNOWN: "neutral" };

/**
 * Contact and conversation context for the open thread.
 *
 * Read-only on purpose: contact management lives on the contact page, and
 * duplicating it here would create a second place where the same record can be
 * edited. Everything shown comes from the conversation payload the thread
 * already loaded, so opening the panel costs no extra request.
 */
export function ConversationDetailsPanel({ conversation, onClose }: { conversation: ConversationDetail; onClose?: () => void }) {
  const c = conversation;
  const isSms = c.channel === "SMS";
  const consent = isSms ? c.contact.smsConsent : c.contact.emailConsent;
  const suppressed = isSms ? c.contact.smsSuppressed : c.contact.suppressed;

  return (
    <div className="flex h-full min-h-0 flex-col bg-ivory">
      <div className="flex items-center justify-between gap-2 border-b border-sage bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-umber">Details</h3>
        {onClose ? (
          <button type="button" onClick={onClose} className="-mr-1 rounded p-1 text-slate-500 hover:bg-sage/40 hover:text-umber" aria-label="Close details">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <dl>
          <Row label="Contact">{c.contact.name ?? <span className="text-slate-400">No name on file</span>}</Row>
          {c.contact.phone ? <Row label="Phone">{c.contact.phone}</Row> : null}
          {c.contact.email ? <Row label="Email">{c.contact.email}</Row> : null}
          {c.contact.organization ? <Row label="Organization">{c.contact.organization}</Row> : null}

          <Row label={isSms ? "SMS consent" : "Email consent"}>
            {consent ? (
              <StatusBadge label={consent.replace(/_/g, " ").toLowerCase()} tone={CONSENT_TONE[consent] ?? "neutral"} />
            ) : (
              <span className="text-slate-400">Not recorded</span>
            )}
            {suppressed ? (
              <span className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {isSms ? "Opted out — SMS is blocked until they text START." : "Suppressed for marketing."}
              </span>
            ) : null}
          </Row>

          <Row label="Channel">{isSms ? "SMS" : "Email"}</Row>
          <Row label="Conversation status">
            <StatusBadge label={c.status.toLowerCase()} tone={c.status === "ARCHIVED" ? "neutral" : "positive"} />
          </Row>
          {isSms && c.businessNumber ? <Row label="Nonni&apos;s number">{c.businessNumber}</Row> : null}
          {!isSms && c.replyAddress ? <Row label="Reply address">{c.replyAddress}</Row> : null}
          <Row label="Started">{formatDateTime(c.createdAt)}</Row>

          {c.contact.lists.length ? <Row label="Lists">{c.contact.lists.join(", ")}</Row> : null}
          {c.contact.tags.length ? <Row label="Tags">{c.contact.tags.join(", ")}</Row> : null}

          {c.originCampaignId ? (
            <Row label="Origin">
              <Link href={`/communications/${isSms ? "sms" : "email"}-campaigns/${c.originCampaignId}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                {c.originCampaignName ?? "View campaign"}
              </Link>
            </Row>
          ) : null}
        </dl>

        <Link
          href={`/communications/contacts/${c.contact.id}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View contact <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
