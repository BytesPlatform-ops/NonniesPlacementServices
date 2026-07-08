import { ArrowRight } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";

export function AboutPreview() {
  return (
    <Section id="about-preview">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <SectionHeading
          eyebrow="Our mission"
          title="Care decisions deserve a steady, expert hand"
          description="Nonni's was built on a simple belief: no family should navigate a care crisis alone, and no good provider should stay invisible to the people who need them. RN-led, Washington-focused, and human at every step — with technology in service of the people, never the other way around."
        />
        <Reveal className="relative">
          <div className="overflow-hidden rounded-[2rem] border border-navy/10 bg-gradient-to-br from-ice to-white p-8 shadow-card">
            <p className="font-display text-2xl font-medium leading-snug text-navy">
              &ldquo;We measure success in weeks of settling in — not a signature on move-in day.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal/15 font-display text-lg font-semibold text-teal">
                RN
              </span>
              <div>
                <p className="font-semibold text-navy">The Nonni&apos;s care team</p>
                <p className="text-sm text-slate-ink/80">Registered nurses & placement specialists</p>
              </div>
            </div>
            <div className="mt-8">
              <Button href="/about" variant="secondary">
                Read our story <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
