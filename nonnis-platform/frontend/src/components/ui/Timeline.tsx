import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/case-status";

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  progress: "bg-indigo-500",
  warning: "bg-amber-500",
  positive: "bg-emerald-500",
  negative: "bg-rose-500",
};

export interface TimelineEntry {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  tone?: StatusTone;
}

/** Vertical event timeline used for workflow history. */
export function Timeline({ items }: { items: TimelineEntry[] }) {
  return (
    <ol className="relative ml-1.5 space-y-5 border-l border-slate-200 pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-[1.53rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
              DOT_CLASSES[item.tone ?? "neutral"],
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-medium text-slate-800">{item.title}</p>
            <time className="text-xs text-slate-400">{item.timestamp}</time>
          </div>
          {item.description ? <p className="mt-0.5 text-sm text-slate-500">{item.description}</p> : null}
        </li>
      ))}
    </ol>
  );
}
