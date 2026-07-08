import { Stethoscope, Sparkles, Handshake, Check } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { CLINICAL_CONDITIONS, BEHAVIORAL_CONDITIONS } from "@/data/careTypes";

const PILLARS = [
  { icon: Stethoscope, title: "RN-led from the start", description: "A Registered Nurse frames the real level of care — so the search starts from clinical clarity, across behavioral and medical health." },
  { icon: Sparkles, title: "Intelligent matching", description: "Structured signals — care level, funding, location, availability, specialty — narrow to strong, real options fast." },
  { icon: Handshake, title: "Coordinated to move-in", description: "Tours, medication reconciliation, and the transition itself are coordinated, then followed up after settling in." },
];

export function SolutionOverview() {
  return (
    <Section id="solution" density="normal">
      <SectionHeading
        eyebrow="The solution"
        title={<>One platform where the <span className="gradient-text">right care</span> finds the right people</>}
        description="Nonni's brings families, hospitals, and providers onto a single, RN-led platform — pairing human clinical judgment with intelligent matching so placement is calmer, clearer, and faster."
        align="center"
        className="mx-auto"
      />

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="relative">
          <ParallaxMedia
            src="/assets/images/senior-family-consultation.jpg"
            alt="A care advisor reviewing options with a family on a tablet"
            className="aspect-[4/3] w-full shadow-card"
            speed={10}
          />
          <div className="absolute -bottom-5 -right-3 max-w-[16rem] rounded-2xl border border-navy/10 bg-white p-4 shadow-card sm:right-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">We place for</p>
            <p className="mt-1 text-sm font-medium text-navy">Behavioral &amp; medical health — from memory care to complex psychiatric needs.</p>
          </div>
        </div>

        <div>
          <Reveal stagger={0.12} className="grid gap-4">
            {PILLARS.map(({ icon: Icon, title, description }) => (
              <div key={title} data-reveal className="flex gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-soft">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ice text-blue">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium text-navy">{title}</h3>
                  <p className="mt-1 text-[0.92rem] leading-relaxed text-slate-ink">{description}</p>
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-5 rounded-2xl border border-navy/10 bg-ice/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-ink/70">We assist individuals requiring</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...CLINICAL_CONDITIONS, ...BEHAVIORAL_CONDITIONS.slice(0, 4)].map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-navy shadow-soft">
                  <Check className="h-3 w-3 text-teal" aria-hidden /> {c}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
