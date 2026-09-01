"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox as InboxIcon, Search } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { listConversations, reviewPendingCount, unreadCount } from "@/services/communications-inbox.service";
import type { InboxView as InboxViewKey } from "@/types/communications-inbox";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { InboundReviewPanel } from "./InboundReviewPanel";
import { InboxConfigBanner } from "./InboxConfigBanner";

type Tab = InboxViewKey | "review";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "needs_reply", label: "Needs Reply" },
  { key: "archived", label: "Archived" },
  { key: "review", label: "Needs Review" },
];
const LIST_POLL_MS = 25_000;

export function InboxView() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("c"));

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [tab, debounced]);

  const isReview = tab === "review";
  const filters = useMemo(() => ({ view: tab as InboxViewKey, search: debounced || undefined, page, pageSize: 20 }), [tab, debounced, page]);
  const list = useAsync(() => (isReview ? Promise.resolve(null) : listConversations(filters)), [isReview, filters]);
  const counts = useAsync(() => Promise.all([unreadCount(), reviewPendingCount()]).then(([u, r]) => ({ unread: u.count, review: r.count })), []);

  // Light inbox polling; reloading the list/badges without disrupting the open thread.
  useEffect(() => {
    const id = setInterval(() => { if (!isReview) list.reload(); counts.reload(); }, LIST_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReview, filters]);

  const select = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("c", id);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  };
  const refreshLists = () => { if (!isReview) list.reload(); counts.reload(); };

  const badge = (n: number) => (n > 0 ? <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{n}</span> : null);

  return (
    <div className="space-y-4">
      <PageHeading title="Inbox" description="Email conversations with your contacts — replies from campaigns and direct outreach, all in one place." />
      <InboxConfigBanner />

      <div className="flex h-[calc(100vh-13rem)] min-h-[32rem] overflow-hidden rounded-lg border border-sage bg-ivory shadow-card">
        {/* LEFT: list + tabs */}
        <div className={`flex w-full min-w-0 flex-col border-r border-sage lg:w-[22rem] lg:shrink-0 ${selectedId && !isReview ? "hidden lg:flex" : "flex"}`}>
          <div className="border-b border-sage px-2 pt-2">
            <div className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => { setTab(t.key); if (t.key !== tab) setSelectedId(null); }}
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${tab === t.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-sage/40"}`}>
                  {t.label}
                  {t.key === "unread" ? badge(counts.data?.unread ?? 0) : null}
                  {t.key === "review" ? badge(counts.data?.review ?? 0) : null}
                </button>
              ))}
            </div>
            {!isReview ? (
              <div className="relative my-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, subject…" className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" />
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isReview ? (
              <InboundReviewPanel onResolved={refreshLists} onOpenConversation={(id) => { setTab("all"); select(id); }} />
            ) : list.loading && !list.data ? (
              <LoadingState label="Loading conversations…" />
            ) : list.error ? (
              <ErrorState message={list.error.message} onRetry={list.reload} />
            ) : (list.data?.items ?? []).length === 0 ? (
              <EmptyState title="No conversations" message="Conversations appear here when a campaign is sent or a contact replies." />
            ) : (
              <>
                <ConversationList items={list.data!.items} selectedId={selectedId} onSelect={select} />
                {list.data!.totalPages > 1 ? (
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
                    <span>Page {page} of {list.data!.totalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 bg-white px-2 py-0.5 disabled:opacity-50">Prev</button>
                      <button type="button" disabled={page >= list.data!.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 bg-white px-2 py-0.5 disabled:opacity-50">Next</button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: thread */}
        <div className={`min-w-0 flex-1 ${selectedId && !isReview ? "flex" : "hidden lg:flex"} flex-col`}>
          {selectedId && !isReview ? (
            <ConversationThread conversationId={selectedId} onMutated={refreshLists} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-slate-400 lg:flex">
              <InboxIcon className="h-8 w-8" aria-hidden />
              <p className="text-sm">{isReview ? "Review unmatched inbound email on the left." : "Select a conversation to read and reply."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
