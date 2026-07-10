import { Hero } from "@/components/sections/Hero";
import { BedMarketplaceStrip } from "@/components/marketplace/BedMarketplaceStrip";
import { HowItWorksScrollJourney } from "@/components/sections/HowItWorksScrollJourney";
import { FloatingMatchCards } from "@/components/sections/FloatingMatchCards";
import { AnimatedMatchConsole } from "@/components/sections/AnimatedMatchConsole";
import { PlacementGallery } from "@/components/sections/PlacementGallery";
import { AudiencePreview } from "@/components/sections/AudiencePreview";
import { ResidentJourney } from "@/components/sections/ResidentJourney";
import { CareStoryCarousel } from "@/components/sections/CareStoryCarousel";
import { ServiceAreaBand } from "@/components/sections/ServiceAreaBand";
import { PricingSection } from "@/components/sections/PricingSection";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CareProfileWizard } from "@/components/forms/CareProfileWizard";
import { FinalCTA } from "@/components/sections/FinalCTA";

/**
 * Home — visual-first, motion-led: hero → live bed marketplace → scroll-stacked
 * "how it works" journey → floating match criteria → live RN match console →
 * Lando-style placement gallery → audiences → cinematic resident journey →
 * fanned care-story deck → Washington network → pricing → CTA.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <BedMarketplaceStrip />
      <HowItWorksScrollJourney />
      <FloatingMatchCards />
      <AnimatedMatchConsole />
      <PlacementGallery />
      <AudiencePreview />
      <ResidentJourney />
      <CareStoryCarousel tone="ice" />
      <ServiceAreaBand />
      <PricingSection />
      <Section id="care-profile" tone="ice" density="normal">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading
            eyebrow="Start your care profile"
            title="Tell us about your loved one"
            description="A few guided taps — no long forms. Share the care picture and an RN-led specialist can begin matching. Your information is private and HIPAA-secure."
          />
          <CareProfileWizard />
        </div>
      </Section>
      <FinalCTA />
    </>
  );
}
