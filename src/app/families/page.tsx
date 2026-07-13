import type { Metadata } from "next";
import { HeartHandshake, Compass, PhoneCall, Check } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { CareTypesGrid } from "@/components/sections/CareTypesGrid";
import { CareStoryCarousel } from "@/components/sections/CareStoryCarousel";
import type { Slide } from "@/components/media/VIPVideoCarousel";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { FindBedForm } from "@/components/forms/FindBedForm";
import { IntakeTimeline } from "@/components/product/IntakeTimeline";
import { FAMILY_FAQS } from "@/data/faqs";
import { CLINICAL_CONDITIONS, BEHAVIORAL_CONDITIONS } from "@/data/careTypes";

export const metadata: Metadata = {
  title: "For Families",
  description: "Warm, RN-led guidance to find the right care placement for someone you love — across Washington State, at $0 cost to families.",
};

const HELP = [
  { icon: Compass, title: "We start with clarity", description: "An RN listens first, then translates a stressful situation into a clear level of care and a real plan." },
  { icon: HeartHandshake, title: "We narrow the options", description: "Instead of dozens of cold calls, you get a short list of communities that genuinely fit — by need, budget, and location." },
  { icon: PhoneCall, title: "We stay with you", description: "From tours to move-in to the weeks after, we coordinate and check in — you're never navigating it alone." },
];

const FAMILY_SLIDES: Slide[] = [
  { type: "image", src: "/assets/nonnis/specialty-care/family-placement-consultation.jpg", caption: "Discussing care options, together", sub: "We meet you where you are" },
  { type: "video", src: "/assets/videos/home-care-checkup.mp4", poster: "/assets/nonnis/specialty-care/rn-tablet-care-review.jpg", caption: "An RN care assessment that fits", sub: "Clarity before the search" },
  { type: "image", src: "/assets/nonnis/specialty-care/caregiver-helping-senior.jpg", caption: "Dignity at every step", sub: "Warm, respectful, unhurried" },
  { type: "image", src: "/assets/nonnis/specialty-care/senior-safe-environment.jpg", caption: "Settled, and well cared for", sub: "45-day RN follow-up after move-in" },
];

export default function FamiliesPage() {
  return (
    <>
      <PageHero
        eyebrow="For Families"
        tone="dark"
        title="Finding the right care, with someone by your side"
        description="When a loved one needs care, the search shouldn't fall on your shoulders alone. Nonni's pairs a Registered Nurse with intelligent matching to find a placement that truly fits — calmly, quickly, and at no cost to your family."
        primary={{ label: "Find Care", href: "#find-a-bed" }}
        secondary={{ label: "Talk to us", href: "/contact" }}
        stats={[
          { v: "$0", l: "Cost to families" },
          { v: "RN", l: "Review on every case" },
          { v: "12", l: "Care types" },
        ]}
        media={
          <div className="relative">
            <ParallaxMedia src="/assets/nonnis/specialty-care/dementia-care-family-guidance.jpg" alt="Family discussing dementia care placement options with support" className="aspect-[4/5] w-full shadow-card" rounded="rounded-[2rem]" speed={8} />
            <div className="absolute -bottom-5 -left-4 max-w-[15rem] rounded-2xl border border-navy/10 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Peace of mind</p>
              <p className="mt-1 text-sm font-medium text-navy">The right care. The right place. For families.</p>
            </div>
          </div>
        }
      />

      {/* How Nonni's helps */}
      <Section id="how-we-help" density="normal">
        <SectionHeading eyebrow="How Nonni's helps" title="A calmer path through a hard moment" description="You bring the love and the knowledge of your family member. We bring the clinical clarity, the network, and the coordination." align="center" className="mx-auto" />
        <Reveal stagger={0.12} className="mt-12 grid gap-5 md:grid-cols-3">
          {HELP.map((h) => <FeatureCard key={h.title} {...h} />)}
        </Reveal>
      </Section>

      {/* Family journey carousel */}
      <CareStoryCarousel
        slides={FAMILY_SLIDES}
        eyebrow="The family journey"
        title="A calmer path, step by step"
        description="From the first difficult conversation to a settled move-in — you're never alone."
        tone="ice"
      />

      {/* RN assessment explainer */}
      <Section tone="ice" density="normal">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <ParallaxMedia src="/assets/nonnis/specialty-care/rn-memory-care-assessment.jpg" alt="Registered Nurse reviewing memory care needs with an older adult" className="aspect-[4/3] w-full shadow-card" speed={10} />
          <div>
            <SectionHeading eyebrow="A nurse's perspective matters" title="Why the RN assessment changes everything" description="We don't simply find an available bed. A Registered Nurse reviews diagnoses, mobility, medications, behavioral concerns, and safety risks — so the match can actually succeed." />
            <Reveal className="mt-6 rounded-2xl border border-navy/10 bg-white p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-ink/70">We assist individuals requiring</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...CLINICAL_CONDITIONS, ...BEHAVIORAL_CONDITIONS.slice(0, 3)].map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-ice px-3 py-1.5 text-xs font-medium text-navy">
                    <Check className="h-3 w-3 text-teal" aria-hidden /> {c}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Care types — all 12 */}
      <CareTypesGrid id="care-types" showAll />

      {/* Find Care form */}
      <Section id="find-a-bed" tone="ice" density="normal">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Find Care" title="Start your placement request" description="Share a few details and an RN-led specialist can begin your assessment. It takes a couple of minutes — and starting is free." />
            <Reveal className="mt-6">
              <IntakeTimeline tone="light" />
            </Reveal>
          </div>
          <FindBedForm />
        </div>
      </Section>

      <FaqSection items={FAMILY_FAQS} description="The questions families ask us most." />
      <FinalCTA />
    </>
  );
}
