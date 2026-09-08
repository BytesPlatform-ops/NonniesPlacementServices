import { Hero } from "@/components/sections/Hero";
import { BedMarketplaceStrip } from "@/components/marketplace/BedMarketplaceStrip";
import { HowItWorksScrollJourney } from "@/components/sections/HowItWorksScrollJourney";
import { FloatingMatchCards } from "@/components/sections/FloatingMatchCards";
import { AnimatedMatchConsole } from "@/components/sections/AnimatedMatchConsole";
import { PlacementGallery } from "@/components/sections/PlacementGallery";
import { AudiencePreview } from "@/components/sections/AudiencePreview";
import { ResidentJourney } from "@/components/sections/ResidentJourney";
import { CareStoryCarousel } from "@/components/sections/CareStoryCarousel";
import { Testimonials } from "@/components/sections/Testimonials";
import { ServiceAreaBand } from "@/components/sections/ServiceAreaBand";
import { PricingSection } from "@/components/sections/PricingSection";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CareProfileWizard } from "@/components/forms/CareProfileWizard";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { fetchResidentialProviders } from "@/lib/platform/content";

/**
 * The marketplace strip mirrors the published residential-provider directory,
 * so the homepage picks up an admin publish/unpublish on the same schedule the
 * directory does (`/residential-providers` also revalidates every 60s, and the
 * underlying fetch every 30s).
 */
export const revalidate = 60;

/**
 * Home — visual-first, motion-led: hero → live bed marketplace → scroll-stacked
 * "how it works" journey → floating match criteria → live RN match console →
 * Lando-style placement gallery → audiences → cinematic resident journey →
 * fanned care-story deck → Washington network → pricing → CTA.
 */
export default async function Home() {
  // Published residential providers, in the admin-set display order the public
  // directory uses. Fetched here because the carousel itself is a client
  // component (Embla) and cannot reach the server-only content helpers.
  const { items: residentialProviders } = await fetchResidentialProviders({ limit: 12 });

  return (
    <>
      <Hero />
      <BedMarketplaceStrip providers={residentialProviders} />
      <HowItWorksScrollJourney />
      <FloatingMatchCards />
      <AnimatedMatchConsole />
      <PlacementGallery />
      <AudiencePreview />
      <ResidentJourney />
      <CareStoryCarousel tone="ice" />
      <Testimonials />
      <ServiceAreaBand />
      <PricingSection />
      <Section id="care-profile" tone="ice" density="normal">
        <div className="mx-auto max-w-6xl">
          {/* Intro sits full-width on top; the form spans the section below it. */}
          <SectionHeading
            eyebrow="Start your care profile"
            title="Tell us about your loved one"
            description="A few guided taps — no long forms. Share the care picture and an RN-led specialist can begin matching. Your information is private and HIPAA-secure."
            className="max-w-[820px]"
          />
          <ul className="mt-5 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-ink">
            {["RN-led", "$0 to families", "HIPAA-secure"].map((pill) => (
              <li key={pill} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 ring-1 ring-navy/10">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                {pill}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <CareProfileWizard />
          </div>
        </div>
      </Section>
      <FinalCTA />
    </>
  );
}
