import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled surface used to group information on a page. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-sage bg-ivory shadow-card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-sage/70 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-umber">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
