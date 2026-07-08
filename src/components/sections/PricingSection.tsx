"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PricingCard } from "@/components/ui/PricingCard";
import { PRICING, type AudienceKey } from "@/data/pricing";
import { PRIMARY_CTA } from "@/data/navigation";

const OPTIONS = PRICING.map((a) => ({ value: a.key, label: a.label }));

export function PricingSection({ id = "pricing" }: { id?: string }) {
  const [audience, setAudience] = useState<AudienceKey>("families");
  const gridRef = useRef<HTMLDivElement>(null);
  const active = PRICING.find((a) => a.key === audience)!;

  // Preselect audience from the URL hash (e.g. /pricing#communities). Must run
  // after mount to stay hydration-safe (the server has no hash), and only once.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hash sync, not a render loop
    if (PRICING.some((a) => a.key === hash)) setAudience(hash as AudienceKey);
  }, []);

  // Animate the tier cards in whenever the audience changes (§17 smooth toggle).
  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !gridRef.current) return;
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out", overwrite: true },
      );
    },
    { dependencies: [audience], scope: gridRef },
  );

  return (
    <Section id={id} tone="ice">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple tiers for every audience"
        description="Families pay a one-time service fee only when they engage a plan. Hospitals and communities subscribe monthly, scaled to how many facilities they serve. Every audience starts free."
        align="center"
        className="mx-auto"
      />

      {/* Hash anchors so /pricing#hospitals etc. scroll here and preselect. */}
      {PRICING.map((a) => (
        <span key={a.key} id={a.key} aria-hidden className="block" style={{ scrollMarginTop: "6rem" }} />
      ))}

      <div className="mt-10 flex justify-center">
        <SegmentedControl
          options={OPTIONS}
          value={audience}
          onChange={(v) => setAudience(v as AudienceKey)}
          ariaLabel="Choose your audience"
        />
      </div>

      <p className="mt-4 text-center text-sm font-medium text-slate-ink" aria-live="polite">
        {active.billing}
      </p>

      <div ref={gridRef} className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {active.tiers.map((tier) => (
          <PricingCard key={`${audience}-${tier.name}`} tier={tier} cta={PRIMARY_CTA} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue transition-colors hover:text-navy">
          Compare all tiers &amp; full features →
        </a>
      </div>
    </Section>
  );
}
