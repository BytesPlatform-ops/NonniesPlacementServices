import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyStageView } from "@/types/seeker";

/**
 * The placement journey as a rail of stages.
 *
 * Stacks vertically on small screens because eight stages cannot read
 * horizontally on a phone, which is where most families will open this.
 */
export function JourneyRail({ stages }: { stages: JourneyStageView[] }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:gap-2" aria-label="Placement progress">
      {stages.map((stage, index) => {
        const done = stage.state === "complete";
        const current = stage.state === "current";
        return (
          <li key={stage.key} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-stretch sm:gap-2">
            {/* Phone: a vertical spine. Desktop: a horizontal bar per stage. */}
            <div className="flex flex-col items-center sm:hidden">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold",
                  done && "bg-emerald-600 text-white",
                  current && "bg-brand-700 text-white ring-4 ring-brand-700/15",
                  !done && !current && "bg-slate-200 text-slate-500",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              {index < stages.length - 1 ? (
                <span className={cn("my-0.5 w-px flex-1 bg-slate-200", done && "bg-emerald-500")} aria-hidden />
              ) : null}
            </div>
            <span
              className={cn(
                "hidden h-1.5 rounded-full sm:block",
                done && "bg-emerald-500",
                current && "bg-brand-700",
                !done && !current && "bg-slate-200",
              )}
              aria-hidden
            />
            <p
              className={cn(
                "pb-4 text-xs leading-snug sm:pb-0",
                current ? "font-semibold text-umber" : done ? "text-slate-600" : "text-slate-400",
              )}
            >
              {stage.label}
              {current ? <span className="sr-only"> (current stage)</span> : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
