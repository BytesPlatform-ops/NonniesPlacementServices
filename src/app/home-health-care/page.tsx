import type { Metadata } from "next";
import { Check, ArrowRight, Stethoscope, Heart } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { HomeCareInquiryForm } from "@/components/forms/HomeCareInquiryForm";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata: Metadata = {
  title: "Home Care",
  description:
    "Compassionate in-home care when your loved one isn't ready for placement. Nonni's Placement Services recommends Cascadia Health Staffing — an RN-founded in-home care agency by the same team — for a seamless continuum of care.",
};

const INTRO = [
  "Many older adults and individuals with disabilities wish to remain in the comfort of their own home for as long as possible. At Nonni's Placement Services, we understand that residential placement isn't always the right first step.",
  "That's why we're proud to recommend Cascadia Health Staffing, an in-home care agency founded by the same healthcare professionals behind Nonni's Placement Services.",
  "Together, our organizations provide families with a seamless continuum of care—from staying safely at home to transitioning into an Adult Family Home, Assisted Living, or Memory Care community when the time is right.",
];

const WHY = [
  "Cascadia Health Staffing shares the same values and commitment to quality care as Nonni's Placement Services.",
  "Our caregivers are carefully selected to provide compassionate, dependable, and person-centered support while promoting independence, dignity, and safety.",
  "Whether your loved one needs a few hours of assistance each week or around-the-clock support, we're here to help.",
];

const SERVICES = [
  "Personal care (bathing, dressing, grooming)",
  "Toileting and incontinence care",
  "Mobility and transfer assistance",
  "Medication reminders",
  "Meal planning and preparation",
  "Light housekeeping",
  "Laundry and linen changes",
  "Grocery shopping and errands",
  "Transportation to appointments",
  "Companionship and social engagement",
  "Respite care for family caregivers",
  "Dementia and Alzheimer's support",
  "Post-hospital recovery assistance",
  "24-hour and live-in care options",
];

const RN_DETERMINE = [
  "Home care is the safest option",
  "Additional nursing services may be beneficial",
  "A future transition to an Adult Family Home or Assisted Living should be considered",
];

const CONTINUUM = ["Home Care", "Adult Family Home", "Assisted Living", "Memory Care"];

const BENEFIT = [
  "Want to remain safely at home",
  "Need assistance after a hospitalization",
  "Have mobility limitations",
  "Live with dementia or cognitive decline",
  "Need help with daily activities",
  "Need temporary respite care for family caregivers",
  "Are not yet ready for residential placement",
];

const TRUST = [
  "RN-founded and healthcare-led",
  "Compassionate, carefully screened caregivers",
  "Flexible scheduling, from a few hours to 24-hour care",
  "Ongoing care coordination",
  "Seamless transition to higher levels of care if needs change",
  "Serving families throughout Washington State",
];

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-[0.98rem] leading-relaxed text-slate-ink">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HomeCarePage() {
  return (
    <>
      <PageHero
        eyebrow="Home Care"
        tone="dark"
        title="Compassionate In-Home Care When Your Loved One Isn't Ready for Placement"
        description={INTRO[0]}
        primary={{ label: "Request Home Care", href: "#request" }}
        secondary={{ label: "Talk to us", href: "/contact" }}
      />

      {/* Intro — recommendation + continuum */}
      <Section tone="ice" density="normal">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 text-lg leading-relaxed text-slate-ink">
          <p>{INTRO[1]}</p>
          <p>{INTRO[2]}</p>
        </div>
      </Section>

      {/* Why Choose Cascadia Health Staffing? */}
      <Section density="normal">
        <SectionHeading eyebrow="Why choose us" title="Why Choose Cascadia Health Staffing?" className="max-w-[820px]" />
        <div className="mt-6 flex max-w-3xl flex-col gap-5 text-lg leading-relaxed text-slate-ink">
          {WHY.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>

      {/* Our Home Care Services */}
      <Section tone="ice" density="normal">
        <SectionHeading eyebrow="Home care services" title="Our Home Care Services" description="We can assist with:" className="max-w-[820px]" />
        <Reveal className="mt-10 rounded-3xl border border-navy/10 bg-white p-6 shadow-soft sm:p-8">
          <CheckList items={SERVICES} />
        </Reveal>
      </Section>

      {/* RN-Led Recommendations */}
      <Section density="normal">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <SectionHeading
            eyebrow="RN-led"
            title="RN-Led Recommendations"
            description="Unlike many agencies, your family's needs can first be reviewed through a nursing perspective."
          />
          <Reveal className="rounded-3xl border border-navy/10 bg-white p-6 shadow-soft sm:p-8">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal/15 text-teal">
                <Stethoscope className="h-4 w-4" aria-hidden />
              </span>
              When appropriate, our Registered Nurse can help determine whether:
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {RN_DETERMINE.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-[0.98rem] leading-relaxed text-slate-ink">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
              Our goal is always to recommend the level of care that best supports your loved one&apos;s health, safety, and independence.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* A Seamless Continuum of Care */}
      <Section tone="dark" density="normal">
        <SectionHeading
          eyebrow="Continuum of care"
          tone="dark"
          title="A Seamless Continuum of Care"
          description="Because Cascadia Health Staffing and Nonni's Placement Services were founded by the same team, families don't have to navigate changing care needs alone. As your loved one's needs evolve, we can help coordinate a smooth transition from:"
          align="center"
          className="mx-auto"
        />
        <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {CONTINUUM.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">
                {step}
              </span>
              {i < CONTINUUM.length - 1 && <ArrowRight className="h-4 w-4 text-mint" aria-hidden />}
            </div>
          ))}
        </Reveal>
        <div className="mt-8 text-center font-display text-xl font-medium text-white">
          <p>One trusted team.</p>
          <p>One care journey.</p>
          <p>Continuous support.</p>
        </div>
      </Section>

      {/* Who Can Benefit? */}
      <Section tone="ice" density="normal">
        <SectionHeading eyebrow="Who benefits" title="Who Can Benefit?" description="Home care may be appropriate for individuals who:" className="max-w-[820px]" />
        <Reveal className="mt-10 rounded-3xl border border-navy/10 bg-white p-6 shadow-soft sm:p-8">
          <CheckList items={BENEFIT} />
        </Reveal>
      </Section>

      {/* Request Home Care Services */}
      <Section id="request" density="normal">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="Get started"
            title="Request Home Care Services"
            description="Complete the form below and a member of our team will contact you to discuss your loved one's needs."
          />
          <div className="mt-10">
            <HomeCareInquiryForm />
          </div>
        </div>
      </Section>

      {/* Why Families Trust Us */}
      <Section tone="ice" density="normal">
        <SectionHeading eyebrow="Trust" title="Why Families Trust Us" align="center" className="mx-auto" />
        <Reveal stagger={0.08} className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TRUST.map((item) => (
            <div key={item} data-reveal className="flex items-start gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-soft">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal">
                <Heart className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="text-[0.95rem] font-medium leading-relaxed text-navy">{item}</span>
            </div>
          ))}
        </Reveal>
      </Section>

      <FinalCTA />
    </>
  );
}
