import type { Metadata } from "next";
import { Stethoscope, House, ClipboardList, HeartHandshake, Compass, Check, BedDouble, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata: Metadata = {
  title: "Home Health Care",
  description:
    "Cascadia provides Registered Nurses and home care services for individuals who need support at home — when a bed placement is not the right fit.",
};

const WHO_FOR = [
  "People who are not eligible for a Nonni's bed placement",
  "Families who want care at home",
  "Seniors needing RN / home care support",
  "People needing extra help after hospital discharge",
  "Families exploring care before moving to a facility",
];

const PROVIDES = [
  {
    icon: Stethoscope,
    title: "Registered Nurse support",
    description: "Licensed RNs bring clinical oversight, assessments, and hands-on nursing care into the home.",
  },
  {
    icon: House,
    title: "Home care services",
    description: "Day-to-day help with personal care, safety, and the routines that keep someone comfortable at home.",
  },
  {
    icon: ClipboardList,
    title: "Care coordination",
    description: "A single point of contact to organize care, communicate with providers, and keep families informed.",
  },
  {
    icon: HeartHandshake,
    title: "Support for families at home",
    description: "Practical, compassionate help for families who would rather keep a loved one in familiar surroundings.",
  },
  {
    icon: Compass,
    title: "Guidance when placement isn't the right option",
    description: "When a facility isn't the answer, Cascadia helps you find the right path to care at home.",
  },
];

export default function HomeHealthCarePage() {
  return (
    <>
      <PageHero
        eyebrow="Cascadia Home Health Care"
        tone="dark"
        title="Home health care, brought to you"
        description="For families who need RN-led support at home — Cascadia provides home care services when bed placement is not the right fit."
        primary={{ label: "Talk to us", href: "/contact" }}
        secondary={{ label: "Explore placement", href: "/families#find-a-bed" }}
        stats={[
          { v: "RN-led", l: "Nursing support at home" },
          { v: "1:1", l: "Personalized home care" },
          { v: "WA", l: "Serving Washington State" },
        ]}
        media={
          <ParallaxMedia
            src="/assets/nonnis/specialty-care/caregiver-helping-senior.jpg"
            alt="Caregiver supporting an older adult at home"
            className="aspect-[4/3] w-full shadow-card"
            rounded="rounded-[2rem]"
            speed={8}
          />
        }
      />

      {/* Who this is for */}
      <Section id="who-its-for" tone="ice" density="normal">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <SectionHeading
            eyebrow="Who Cascadia is for"
            title="Care that comes to you"
            description="Cascadia provides Registered Nurses and home care services for individuals who need support at home. If someone is not ready for a bed placement, does not qualify for a bed, or simply wants care in the comfort of their own home, Cascadia can help bring care support to them."
          />
          <Reveal className="rounded-3xl border border-navy/10 bg-white p-6 shadow-soft sm:p-8">
            <ul className="flex flex-col gap-3.5">
              {WHO_FOR.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-[0.98rem] leading-relaxed text-slate-ink">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* What Cascadia provides */}
      <Section id="what-we-provide" density="normal">
        <SectionHeading
          eyebrow="What Cascadia provides"
          title="RN-led care, delivered at home"
          description="Everything needed to support a safe, comfortable stay at home — with clinical oversight at the center."
          align="center"
          className="mx-auto"
        />
        <Reveal stagger={0.1} className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PROVIDES.map((p) => (
            <FeatureCard key={p.title} {...p} />
          ))}
        </Reveal>
      </Section>

      {/* Connection to Nonni's */}
      <Section id="nonnis-connection" tone="ice" density="normal">
        <SectionHeading
          eyebrow="How it fits with Nonni's"
          title="Two ways to reach the right care"
          description="Nonni's and Cascadia work side by side — so families have a path whether care happens in a community or at home."
          align="center"
          className="mx-auto"
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <Reveal className="flex h-full flex-col rounded-3xl border border-navy/10 bg-white p-7 shadow-soft">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ice text-blue">
              <BedDouble className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-5 font-display text-xl font-medium text-navy">Nonni's</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-ink">
              Nonni's helps families find the right care bed or community — RN-reviewed placement into
              adult family homes, assisted living, memory care, and more.
            </p>
            <Button href="/families#find-a-bed" variant="secondary" className="mt-6 self-start">
              Find a placement <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Reveal>
          <Reveal className="flex h-full flex-col rounded-3xl border border-teal/30 bg-white p-7 shadow-card ring-1 ring-teal/20">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-teal">
              <House className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-5 font-display text-xl font-medium text-navy">Cascadia</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-ink">
              Cascadia helps families receive care support at home when home care is the better option —
              bringing RN-led nursing and home care services to where someone already lives.
            </p>
            <Button href="/contact" variant="primary" className="mt-6 self-start">
              Talk to us <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Reveal>
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
