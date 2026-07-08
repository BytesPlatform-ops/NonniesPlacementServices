import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Badge } from "./Badge";
import type { Tier } from "@/data/pricing";

const MAX_FEATURES = 6;

export function PricingCard({ tier, cta }: { tier: Tier; cta: { label: string; href: string } }) {
  const highlighted = !!tier.highlight;
  const shown = tier.features.slice(0, MAX_FEATURES);
  const extra = tier.features.length - shown.length;
  return (
    <div
      data-reveal
      className={cn(
        "relative flex h-full flex-col rounded-3xl border p-7 transition-all duration-300",
        highlighted
          ? "border-mint/50 bg-white shadow-card ring-2 ring-mint/40 lg:-translate-y-3 hover:-translate-y-4 hover:shadow-[0_44px_100px_-34px_rgba(209,143,71,0.55)]"
          : "border-navy/10 bg-white/80 backdrop-blur-sm shadow-soft hover:-translate-y-1.5 hover:border-coral/40 hover:shadow-[0_32px_74px_-32px_rgba(181,111,40,0.45)]",
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-7">
          <Badge tone="teal">Most popular</Badge>
        </div>
      )}
      <h3 className="font-display text-xl font-medium text-navy">{tier.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold tracking-tight text-navy">{tier.price}</span>
        <span className="text-sm font-medium text-slate-ink">{tier.cadence}</span>
      </div>
      <p className="mt-2 min-h-[2.5rem] text-sm text-slate-ink">{tier.blurb}</p>

      <Button
        href={cta.href}
        variant={highlighted ? "primary" : "secondary"}
        className="mt-5 w-full"
      >
        {cta.label}
      </Button>

      <ul className="mt-6 space-y-2.5 border-t border-navy/10 pt-6 text-sm">
        {shown.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-slate-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <p className="mt-3 text-xs font-semibold text-teal">+ {extra} more included</p>
      )}
    </div>
  );
}
