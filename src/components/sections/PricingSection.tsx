import { BadgeDollarSign, HeartHandshake, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/animation/Reveal";
import { PRIMARY_CTA } from "@/data/navigation";

const POINTS = [
  {
    icon: BadgeDollarSign,
    title: "$0 cost to families",
    text: "Our core matching and placement service is completely free for families — you never pay to find the right care.",
  },
  {
    icon: HeartHandshake,
    title: "RN-led from search to move-in",
    text: "A registered nurse reviews every match and guides you through the process at no cost to you.",
  },
  {
    icon: ShieldCheck,
    title: "Licensed & verified providers",
    text: "Provider licenses are validated before any family is connected, so every option is one you can trust.",
  },
];

export function PricingSection({ id = "pricing" }: { id?: string }) {
  return (
    <Section id={id} tone="ice">
      <SectionHeading
        eyebrow="Pricing"
        title="Placement is $0 cost to families"
        description="Our core matching and placement service is free for families. An RN reviews every match and walks with you from first search to move-in — at no cost to you."
        align="center"
        className="mx-auto"
      />

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {POINTS.map((p) => (
          <Reveal
            key={p.title}
            className="flex h-full flex-col rounded-3xl border border-navy/10 bg-white/80 p-7 shadow-soft backdrop-blur-sm"
          >
            <p.icon className="h-7 w-7 text-teal" aria-hidden />
            <h3 className="mt-4 font-display text-xl font-medium text-navy">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-ink">{p.text}</p>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button href={PRIMARY_CTA.href} variant="primary">
          {PRIMARY_CTA.label}
        </Button>
      </div>
    </Section>
  );
}
