import { cn } from "@/lib/utils";

type BadgeTone = "teal" | "coral" | "navy" | "mint" | "neutral";

const TONES: Record<BadgeTone, string> = {
  teal: "bg-teal/10 text-teal ring-1 ring-teal/20",
  coral: "bg-coral/10 text-coral ring-1 ring-coral/20",
  navy: "bg-navy/10 text-navy ring-1 ring-navy/15",
  mint: "bg-mint/15 text-mint ring-1 ring-mint/25",
  neutral: "bg-white/10 text-white/80 ring-1 ring-white/20",
};

export function Badge({
  tone = "teal",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
