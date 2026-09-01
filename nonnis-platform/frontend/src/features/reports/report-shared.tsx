import type { StatusTone } from "@/lib/case-status";
import type { GroupCount } from "@/types/reports";

/** Readable label + semantic tone helpers for statuses that aren't case statuses. */
export function readinessTone(level: string): StatusTone {
  if (level === "READY") return "positive";
  if (level === "BLOCKED") return "negative";
  return "warning";
}

export function referralStatusTone(status: string): StatusTone {
  switch (status) {
    case "ACCEPTED":
      return "positive";
    case "DECLINED":
    case "WITHDRAWN":
    case "CANCELLED":
      return "negative";
    case "INFORMATION_REQUESTED":
    case "CONDITIONALLY_ACCEPTED":
      return "warning";
    case "DRAFT":
      return "neutral";
    default:
      return "progress";
  }
}

export function taskStatusTone(status: string): StatusTone {
  switch (status) {
    case "COMPLETED":
      return "positive";
    case "CANCELLED":
      return "neutral";
    case "IN_PROGRESS":
      return "progress";
    default:
      return "info";
  }
}

export function priorityTone(priority: string): StatusTone {
  switch (priority) {
    case "URGENT":
      return "negative";
    case "HIGH":
      return "warning";
    case "LOW":
      return "neutral";
    default:
      return "info";
  }
}

export function providerStatusTone(status: string): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "positive";
    case "PAUSED":
      return "warning";
    default:
      return "neutral";
  }
}

export function capacityTone(capacity: string): StatusTone {
  switch (capacity) {
    case "AVAILABLE":
      return "positive";
    case "LIMITED":
      return "warning";
    case "UNAVAILABLE":
      return "negative";
    default:
      return "neutral";
  }
}

export function formStatusTone(status: string): StatusTone {
  switch (status) {
    case "RESOLVED":
      return "positive";
    case "IN_REVIEW":
      return "progress";
    case "ARCHIVED":
      return "neutral";
    default:
      return "info";
  }
}

/** Inclusive last-30-days range as `YYYY-MM-DD` bounds. */
export function last30Days(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

export type CardTone = "neutral" | "positive" | "warning" | "negative" | "info";

export interface SummaryCard {
  label: string;
  value: number | string;
  tone?: CardTone;
}

const TONE: Record<CardTone, string> = {
  neutral: "text-umber",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  negative: "text-rose-700",
  info: "text-sky-700",
};

/** Compact metric cards (counts only — no trends/comparisons). */
export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="report-card rounded-lg border border-sage bg-ivory px-4 py-3 shadow-card">
          <p className="text-xs font-medium text-slate-500">{card.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${TONE[card.tone ?? "neutral"]}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export interface GroupSection {
  title: string;
  rows: GroupCount[];
}

/** Simple grouped-count tables (no charts). */
export function GroupTables({ sections }: { sections: GroupSection[] }) {
  const visible = sections.filter((s) => s.rows.length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visible.map((section) => (
        <div key={section.title} className="report-card overflow-hidden rounded-lg border border-sage bg-ivory shadow-card">
          <header className="border-b border-sage/70 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-umber">{section.title}</h3>
          </header>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {section.rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-2 text-slate-700">{row.label}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-umber">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
