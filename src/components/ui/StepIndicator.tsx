import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Multi-step form progress indicator (§16). */
export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-teal text-white",
                  active && "bg-navy text-white ring-4 ring-navy/15",
                  !done && !active && "bg-ice text-slate-ink",
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-navy" : "text-slate-ink/70",
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn("h-px flex-1 transition-colors", done ? "bg-teal" : "bg-navy/15")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
