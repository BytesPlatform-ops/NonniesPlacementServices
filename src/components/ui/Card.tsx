import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-navy/10 bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
