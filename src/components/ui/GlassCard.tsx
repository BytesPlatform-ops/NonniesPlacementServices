import { cn } from "@/lib/utils";

/** Frosted glass surface — for hero cards, pricing, modals only (§G). */
export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl",
        "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
