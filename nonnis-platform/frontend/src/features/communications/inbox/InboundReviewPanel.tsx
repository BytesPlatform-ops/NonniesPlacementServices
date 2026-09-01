"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { MutationButton } from "@/components/ui/MutationButton";
import { useToast } from "@/providers/toast-provider";
import { ApiError } from "@/lib/api-client";
import { listContacts } from "@/services/communications.service";
import { dismissReview, linkReview, listReviews } from "@/services/communications-inbox.service";
import type { ContactView } from "@/types/communications";
import type { InboundReviewView } from "@/types/communications-inbox";
import { reviewReasonLabel } from "./inbox-format";

export function InboundReviewPanel({ onResolved, onOpenConversation }: { onResolved: () => void; onOpenConversation: (id: string) => void }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const { data, loading, error, reload } = useAsync(() => listReviews({ status: "PENDING", pageSize: 50 }), []);
  const [linking, setLinking] = useState<InboundReviewView | null>(null);

  const afterResolve = () => { reload(); onResolved(); };

  if (loading && !data) return <LoadingState label="Loading review queue…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const items = data?.items ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <EmptyState title="Nothing to review" message="Inbound email that can't be matched to a conversation, or fails a sender check, is safely quarantined here." />
      ) : (
        <ul className="divide-y divide-sage/70">
          {items.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-umber">{r.fromName ?? r.fromEmail}</span>
                <span className="text-xs text-slate-400">{r.fromEmail}</span>
                <StatusBadge label={reviewReasonLabel(r.reason)} tone="warning" />
                <span className="ml-auto text-xs text-slate-400">{formatDateTime(r.receivedAt ?? r.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{r.subject ?? "(no subject)"}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.preview ?? r.textBody ?? ""}</p>
              {canManage ? (
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => setLinking(r)} className="text-xs font-medium text-brand-700 hover:underline">Link to a contact…</button>
                  <MutationButton variant="danger-link" action={() => dismissReview(r.id)} confirm={{ title: "Dismiss this message?", description: "Use this for spam or irrelevant mail. It will be removed from the review queue.", confirmLabel: "Dismiss", variant: "danger" }} successToast="Message dismissed" onSuccess={afterResolve}>
                    Dismiss
                  </MutationButton>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Linking or dismissing requires manage permission.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {linking ? (
        <LinkToContactModal
          review={linking}
          onClose={() => setLinking(null)}
          onLinked={(conversationId) => { setLinking(null); afterResolve(); onOpenConversation(conversationId); }}
        />
      ) : null}
    </div>
  );
}

function LinkToContactModal({ review, onClose, onLinked }: { review: InboundReviewView; onClose: () => void; onLinked: (conversationId: string) => void }) {
  const toast = useToast();
  const [search, setSearch] = useState(review.fromEmail);
  const [debounced, setDebounced] = useState(review.fromEmail);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  const results = useAsync(() => listContacts({ search: debounced || undefined, pageSize: 8 }), [debounced]);

  const pick = async (contact: ContactView) => {
    setBusy(true);
    try {
      const { conversationId } = await linkReview(review.id, { contactId: contact.id });
      toast.success("Message linked");
      onLinked(conversationId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not link the message.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Link message to a contact" onClose={onClose} size="md">
      <p className="text-sm text-slate-500">Linking creates a conversation for the chosen existing contact. A stranger is never turned into a contact automatically.</p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts by name or email…" className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" autoFocus />
      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-sage">
        {results.loading ? (
          <p className="px-3 py-4 text-sm text-slate-400">Searching…</p>
        ) : (results.data?.items ?? []).length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400">No matching contacts.</p>
        ) : (
          <ul className="divide-y divide-sage/70">
            {(results.data?.items ?? []).map((ct) => (
              <li key={ct.id}>
                <button type="button" disabled={busy} onClick={() => void pick(ct)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ivory disabled:opacity-50">
                  <span><span className="text-sm font-medium text-umber">{[ct.firstName, ct.lastName].filter(Boolean).join(" ") || ct.email}</span> <span className="text-xs text-slate-400">{ct.email}</span></span>
                  <span className="text-xs text-brand-700">Link</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
