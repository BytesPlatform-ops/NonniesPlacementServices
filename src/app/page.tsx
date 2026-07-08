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
      <FinalCTA />
    </>
  );
}
