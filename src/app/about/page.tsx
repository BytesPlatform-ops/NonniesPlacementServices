import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { StatCard } from "@/components/ui/StatCard";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { WashingtonMap } from "@/components/product/WashingtonMap";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { TRUST_STATS } from "@/data/features";
import { Stethoscope, HeartHandshake, Scale, Eye, MapPinned, Brain, ClipboardList, Search, Home, HandHeart } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description: "Nonni's is an RN-led care placement platform for Washington State — pairing human clinical judgment with intelligent matching, across behavioral and medical health.",
};

const VALUES = [
  { icon: Stethoscope, title: "Clinical judgment first", description: "A Registered Nurse leads every placement. Technology assists the decision — it never makes it." },
  { icon: Brain, title: "Behavioral & medical depth", description: "Real experience with complex psychiatric, behavioral, and medical needs others turn away." },
  { icon: HeartHandshake, title: "Human at every step", description: "Families reach real people. We measure success in weeks of settling in, not a single signature." },
  { icon: Scale, title: "Honest by default", description: "No guaranteed outcomes, no overclaiming. We surface strong, real options and are clear about what we don't know." },
];

const PROCESS = [
  { icon: ClipboardList, title: "Assess & understand", description: "An RN reviews medical, behavioral, and daily-care needs — the full picture." },
  { icon: Search, title: "Research & shortlist", description: "Matching narrows the field to communities that can truly meet those needs." },
  { icon: Home, title: "Visit & select", description: "Families see real, available options and choose with confidence." },
  { icon: HandHeart, title: "Smooth placement", description: "We coordinate the move-in and stay close through the transition." },
];

const MARKETPLACE = [
  { icon: Eye, title: "Reviewed before connected", description: "Matching narrows the field, then an RN reviews fit before anyone is introduced — protecting families and providers alike." },
  { icon: MapPinned, title: "Made for Washington", description: "Built around Washington's care types, funding realities, and regional availability, from our home base in Tacoma." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our mission"
        title="No family should navigate a care crisis alone"
        description="Nonni's Placement Services began with a simple conviction: care decisions are among the hardest a family will make, and they deserve a steady, clinical hand. We're an RN-led, Washington-focused platform pairing nursing judgment with intelligent matching — across behavioral and medical health."
        primary={{ label: "Talk to us", href: "/contact" }}
        secondary={{ label: "Find Care", href: "/families#find-a-bed" }}
        media={
          <ParallaxMedia src="/assets/images/rn-review-process.jpg" alt="A registered nurse clinical team" className="aspect-[4/3] w-full shadow-card" rounded="rounded-[2rem]" speed={8} />
        }
      />

      {/* A nurse's perspective */}
      <Section density="normal">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <ParallaxMedia src="/assets/images/caregiver-resident-room.jpg" alt="A caregiver with a resident" className="aspect-[4/3] w-full shadow-card" speed={10} />
          <div>
            <SectionHeading eyebrow="A nurse's perspective matters" title="We don't simply find an available bed" description="Unlike traditional placement agencies, every referral receives a clinical review by a Registered Nurse with extensive behavioral and medical health experience. We identify communities that can successfully meet the individual's medical, behavioral, mobility, medication, cognitive, financial, and long-term-care needs — to reduce placement failures and improve transitions." />
          </div>
        </div>
      </Section>

      {/* Values */}
      <Section id="values" tone="ice" density="normal">
        <SectionHeading eyebrow="What we stand for" title="Trust is the whole product" description="Everything we build is measured against one question: does it help a family, hospital, or provider make a better care decision?" align="center" className="mx-auto" />
        <Reveal stagger={0.08} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => <FeatureCard key={v.title} {...v} />)}
        </Reveal>
      </Section>

      {/* Marketplace + process infographic */}
      <Section id="marketplace" density="normal">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading eyebrow="The care marketplace" title="A trusted layer between need and care" description="Care placement has always relied on personal networks and frantic phone calls. Nonni's turns that into a coordinated, RN-reviewed marketplace — so the right care and the right people actually meet." />
            <Reveal stagger={0.12} className="mt-6 grid gap-4">
              {MARKETPLACE.map((m) => <FeatureCard key={m.title} {...m} />)}
            </Reveal>
          </div>
          <Reveal stagger={0.1} className="rounded-[2rem] border border-navy/10 bg-white p-6 shadow-card sm:p-8">
            <p data-reveal className="text-xs font-semibold uppercase tracking-[0.16em] text-blue">The placement path</p>
            <div className="mt-6 space-y-4">
              {PROCESS.map((p, i) => (
                <div
                  key={p.title}
                  data-reveal
                  className="group flex items-start gap-4 rounded-2xl border border-navy/10 bg-ice/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-coral/40 hover:bg-ice hover:shadow-soft"
                >
                  <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-coral to-coral-600 text-white shadow-soft">
                    <p.icon className="h-5 w-5" aria-hidden />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[0.65rem] font-bold text-ivory">{i + 1}</span>
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-display text-lg font-medium text-navy">{p.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-ink">{p.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Network + stats */}
      <Section id="impact" tone="dark" density="normal">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionHeading eyebrow="Our footprint" tone="dark" title="Care coordinated across Washington" description="From Seattle and Tacoma to Spokane and the Tri-Cities — RN-led placement across 39 counties." />
            <Reveal stagger={0.1} className="mt-8 grid grid-cols-2 gap-4">
              {TRUST_STATS.map((s) => <StatCard key={s.label} {...s} tone="dark" />)}
            </Reveal>
          </div>
          <Reveal className="rounded-[2rem] border border-white/10 bg-midnight-800/60 p-6 backdrop-blur-sm">
            <div className="aspect-[100/62] w-full">
              <WashingtonMap tone="dark" />
            </div>
          </Reveal>
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
