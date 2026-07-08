import { Quote, BadgeCheck, ShieldCheck, MapPinned } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { StatCard } from "@/components/ui/StatCard";
import { TRUST_STATS } from "@/data/features";

const TESTIMONIALS = [
  {
    quote:
      "The nurse understood Mom's needs better than we could explain them. We toured two homes that actually fit — and picked one in three days.",
    name: "Dana R.",
    role: "Daughter & caregiver · Bellevue",
  },
  {
    quote:
      "As a discharge planner, the mismatched calls used to eat my afternoons. Now the options that come back already fit the care level and funding.",
    name: "Marcus T.",
    role: "Hospital discharge planner · Tacoma",
  },
  {
    quote:
      "We filled two long-open memory-care beds with residents who were genuinely the right fit for our team. That's the part that matters.",
    name: "Priya S.",
    role: "Community director · Spokane",
  },
];

const BADGES = [
  { icon: BadgeCheck, label: "RN-led guidance" },
  { icon: ShieldCheck, label: "License-aware listings" },
  { icon: MapPinned, label: "Washington State focus" },
];

export function TrustSection() {
  return (
    <Section id="trust">
      <SectionHeading
        eyebrow="Trusted care"
        title="Real people, calmer decisions"
        description="Nonni's exists for the hardest moments in a family's year — and for the providers working to care well. Here's the difference an RN-led, well-matched process makes."
        align="center"
        className="mx-auto"
      />

      <Reveal stagger={0.1} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </Reveal>

      <Reveal stagger={0.12} className="mt-8 grid gap-5 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            data-reveal
            className="flex h-full flex-col rounded-3xl border border-navy/10 bg-white p-7 shadow-soft"
          >
            <Quote className="h-8 w-8 text-teal/40" aria-hidden />
            <blockquote className="mt-4 flex-1 text-[0.98rem] leading-relaxed text-slate-ink">
              {t.quote}
            </blockquote>
            <figcaption className="mt-6 border-t border-navy/10 pt-4">
              <p className="font-semibold text-navy">{t.name}</p>
              <p className="text-sm text-slate-ink/80">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </Reveal>

      <Reveal className="mt-10 flex flex-wrap justify-center gap-4">
        {BADGES.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-ice px-4 py-2 text-sm font-semibold text-navy"
          >
            <Icon className="h-4.5 w-4.5 text-teal" aria-hidden />
            {label}
          </span>
        ))}
      </Reveal>
    </Section>
  );
}
