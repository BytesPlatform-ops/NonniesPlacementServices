import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { DIFFERENTIATORS } from "@/data/features";

export function Differentiators() {
  return (
    <Section id="differentiators" tone="ice">
      <SectionHeading
        eyebrow="Why Nonni's"
        title="Built for trust, tuned for fit"
        description="What sets Nonni's apart is the balance: real clinical oversight from a registered nurse, paired with intelligent matching and a two-sided network built around Washington State."
        align="center"
        className="mx-auto"
      />
      <Reveal stagger={0.08} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {DIFFERENTIATORS.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </Reveal>
    </Section>
  );
}
