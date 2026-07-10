import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { PricingSection } from "@/components/sections/PricingSection";
import { PricingComparison } from "@/components/sections/PricingComparison";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { AIMatchDashboard } from "@/components/product/AIMatchDashboard";
import { PRICING_FAQS } from "@/data/faqs";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, tiered pricing for families, hospitals, and communities. Every audience starts free — pay only for the support you need.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        tone="dark"
        title="Pricing that fits how you use Nonni's"
        description="Three audiences, three simple structures — each with an Introductory, Silver, Gold, and Platinum tier. Families pay a one-time fee only when they engage a plan; hospitals and communities subscribe monthly. Everyone starts free."
        primary={{ label: "Find Care", href: "/families#find-a-bed" }}
        secondary={{ label: "List Your Beds", href: "/providers#list-your-beds" }}
        stats={[
          { v: "$0", l: "To start, every audience" },
          { v: "4", l: "Tiers per audience" },
          { v: "45d", l: "RN case mgmt (Platinum)" },
        ]}
        media={
          <div className="hidden lg:block">
            <AIMatchDashboard />
          </div>
        }
      />
      <PricingSection id="pricing-tables" />
      <PricingComparison />
      <FaqSection items={PRICING_FAQS} tone="ice" description="How our pricing works, in plain terms." />
      <FinalCTA />
    </>
  );
}
