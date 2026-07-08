import { Check, Minus } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { cn } from "@/lib/utils";
import { PRICING } from "@/data/pricing";

// Feature ladder is identical across audiences (only price differs) — use it for the matrix.
const LADDER = PRICING[0].tiers;
const ALL_FEATURES = LADDER[LADDER.length - 1].features;

export function PricingComparison() {
  return (
    <Section id="compare" density="normal">
      <SectionHeading
        eyebrow="Compare tiers"
        title="What each tier unlocks"
        description="Every tier includes everything below it, then adds more — from a free HIPAA-compliant profile up to 45-day RN case management."
        align="center"
        className="mx-auto"
      />

      <Reveal className="mt-10 overflow-x-auto rounded-3xl border border-navy/10 shadow-soft">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-ice">
              <th className="sticky left-0 z-10 bg-ice px-5 py-4 text-sm font-semibold text-navy">Feature</th>
              {LADDER.map((t) => (
                <th key={t.name} className={cn("px-4 py-4 text-center text-sm font-semibold", t.highlight ? "text-teal" : "text-navy")}>
                  {t.name}
                  {t.highlight && <span className="ml-1 rounded-full bg-teal/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-teal">Popular</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_FEATURES.map((feature, i) => (
              <tr key={feature} className={cn("border-t border-navy/10", i % 2 ? "bg-white" : "bg-ice/30")}>
                <td className="sticky left-0 z-10 bg-inherit px-5 py-3 text-sm text-slate-ink">{feature}</td>
                {LADDER.map((t) => {
                  const has = t.features.includes(feature);
                  return (
                    <td key={t.name} className="px-4 py-3 text-center">
                      {has ? (
                        <Check className={cn("mx-auto h-4.5 w-4.5", t.highlight ? "text-teal" : "text-navy")} aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-navy/20" aria-label="Not included" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </Section>
  );
}
