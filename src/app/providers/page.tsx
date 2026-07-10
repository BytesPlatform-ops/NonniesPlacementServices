import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { StatCard } from "@/components/ui/StatCard";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ListBedsForm } from "@/components/forms/ListBedsForm";
import { ProviderAvailabilityBoard } from "@/components/product/ProviderAvailabilityBoard";
import { ProviderPortalPreview } from "@/components/product/ProviderPortalPreview";
import { DischargePlannerView } from "@/components/product/DischargePlannerView";
import { ProviderListingGrid } from "@/components/marketplace/BedMarketplaceStrip";
import { CareStoryCarousel } from "@/components/sections/CareStoryCarousel";
import type { Slide } from "@/components/media/VIPVideoCarousel";
import { PROVIDER_FAQS } from "@/data/faqs";

const PROVIDER_SLIDES: Slide[] = [
  { type: "video", src: "/assets/videos/provider-care-loop.mp4", poster: "/assets/nonnis/specialty-care/provider-memory-care-room.jpg", caption: "Care your team delivers, seen", sub: "Show the daily life residents will join" },
  { type: "image", src: "/assets/nonnis/specialty-care/provider-memory-care-room.jpg", caption: "Fill rooms with the right fit", sub: "RN-reviewed, better-matched inquiries" },
  { type: "image", src: "/assets/nonnis/specialty-care/behavioral-health-placement-support2.jpg", caption: "Behavioral & memory care, ready", sub: "Highlight what makes you different" },
  { type: "image", src: "/assets/images/caregiver-resident-room.jpg", caption: "Availability in one clear view", sub: "Beds, pricing, and funding, live" },
];
import { Target, LineChart, Workflow, ShieldCheck, Users2, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "For Providers",
  description: "List your Washington care community and fill vacancies with residents who genuinely fit — through RN-reviewed, intelligent matching.",
};

const WHY = [
  { icon: Target, title: "Better-fit inquiries", description: "Reach seekers whose care level, funding, and timing match what you offer — fewer wasted tours." },
  { icon: LineChart, title: "Real-time demand data", description: "See live placement demand, wallet-share analytics, and niche pricing dynamics across the network." },
  { icon: Workflow, title: "Less manual back-and-forth", description: "Digitized intake, synced calendars, and coordination tools cut the phone tag out of admissions." },
  { icon: ShieldCheck, title: "RN-reviewed matches", description: "A nurse confirms fit before families are connected, so the introductions you get are real ones." },
  { icon: Users2, title: "A two-sided network", description: "Tap into hospital discharge planners and families across Washington from one profile." },
  { icon: Clock, title: "Fill beds faster", description: "Open beds get surfaced to the right people the moment they're searching." },
];

const STATS = [
  { value: 480, suffix: "+", label: "Community listings" },
  { value: 39, label: "WA counties reached" },
  { value: 92, suffix: "%", label: "Avg. top-match fit score" },
];

export default function ProvidersPage() {
  return (
    <>
      <PageHero
        eyebrow="For Providers"
        tone="dark"
        title="Fill vacancies with residents who truly fit"
        description="List your Adult Family Home, Assisted Living, Memory Care, Behavioral Health, Hospice, or Skilled Nursing community. Nonni's connects you with seekers whose needs match what you do best — RN-reviewed before they reach you."
        primary={{ label: "List Your Beds", href: "#list-your-beds" }}
        secondary={{ label: "How it works", href: "/#how-it-works" }}
        media={
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
              <Image src="/assets/nonnis/specialty-care/provider-memory-care-room.jpg" alt="Provider room prepared for memory care placement" width={720} height={520} className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-72 sm:block">
              <DischargePlannerView tone="dark" />
            </div>
          </div>
        }
      />

      <Section id="why-list" density="normal">
        <SectionHeading eyebrow="Why list with Nonni's" title="Growth built on the right match" description="Empty beds and mismatched inquiries are expensive. A well-matched, RN-reviewed network fixes both." align="center" className="mx-auto" />
        <Reveal stagger={0.08} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => <FeatureCard key={w.title} {...w} />)}
        </Reveal>
      </Section>

      {/* Provider video carousel */}
      <CareStoryCarousel
        slides={PROVIDER_SLIDES}
        eyebrow="Your community, showcased"
        title="Let families see the care you give"
        description="Photos and short clips help the right residents choose you with confidence."
        tone="dark"
      />

      {/* Facility marketplace cards */}
      <Section tone="ice" density="normal">
        <SectionHeading eyebrow="Live marketplace" title="How your listing appears" description="Every listing shows real-time beds, care specialties, funding accepted, pricing, and an RN-reviewed match score." align="center" className="mx-auto" />
        <div className="mt-10">
          <ProviderListingGrid />
        </div>
      </Section>

      {/* Availability board demo */}
      <Section tone="dark" density="normal">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <SectionHeading eyebrow="Your availability board" tone="dark" title="Real-time beds, matched to real demand" description="Publish specialties, open beds, pricing, and accepted funding. The platform surfaces RN-reviewed, best-fit inquiries — ranked by match score — straight to your queue." />
          <Reveal><ProviderAvailabilityBoard tone="dark" /></Reveal>
        </div>
      </Section>

      {/* Provider portal */}
      <Section density="normal">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal className="lg:order-2">
            <SectionHeading eyebrow="Provider portal" title="Everything to manage placements in one place" description="List beds, upload community photos, set specialties and pricing, verify your license, and work an inquiry queue that's already matched by an RN." />
          </Reveal>
          <Reveal className="lg:order-1"><ProviderPortalPreview /></Reveal>
        </div>
      </Section>

      <Section id="discharge" tone="ice" density="dense">
        <Reveal stagger={0.12} className="grid gap-5 sm:grid-cols-3">
          {STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </Reveal>
      </Section>

      <Section id="list-your-beds" density="normal">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading eyebrow="List Your Beds" title="Add your community" description="Tell us about your community and available beds. Listing starts free — we'll verify your license before publishing." />
          <ListBedsForm />
        </div>
      </Section>

      <FaqSection items={PROVIDER_FAQS} tone="ice" description="What providers ask before listing." />
      <FinalCTA />
    </>
  );
}
