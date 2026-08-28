"use client";

import { useState } from "react";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { messageScopeLabel } from "@/lib/task-status";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { getCaseTimeline } from "@/services/messages.service";
import type { CaseDetail } from "@/types/domain";
import type { TimelineItem } from "@/types/messages";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "case", label: "Case" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Messages" },
  { key: "referrals", label: "Referrals" },
];

const CATEGORY_DOT: Record<string, string> = {
  task: "bg-indigo-400",
  referral: "bg-brand-500",
  service: "bg-emerald-500",
  requirement: "bg-amber-500",
  service_request: "bg-sky-500",
  message: "bg-slate-400",
  case: "bg-umber",
};

function itemTitle(item: TimelineItem): string {
  return item.source === "message" ? `${messageScopeLabel(item.type)} message` : humanizeEnum(item.type);
}

export function ActivityTab({ caseDetail }: { caseDetail: CaseDetail }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => getCaseTimeline(caseDetail.id, { filter, page, pageSize: 30 }), [caseDetail.id, filter, page]);
  const totalPages = data?.totalPages ?? 0;

  return (
    <Panel title="Activity" description="One unified history: case changes, tasks, referrals, and messages you can see.">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); setPage(1); }}
            aria-pressed={filter === f.key}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Loading activity…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No activity" message="Nothing to show for this filter yet." />
      ) : (
        <>
          <ul className="space-y-4">
            {data.items.map((item) => (
              <li key={`${item.source}-${item.id}`} className="flex gap-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", CATEGORY_DOT[item.category] ?? "bg-slate-400")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-umber">{itemTitle(item)}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(item.occurredAt)}{item.actor ? ` · ${item.actor}` : ""}</span>
                  </div>
                  {item.detail ? <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">{item.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} item{data.total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
