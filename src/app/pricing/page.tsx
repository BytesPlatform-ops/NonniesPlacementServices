import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { PricingSection } from "@/components/sections/PricingSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { AIMatchDashboard } from "@/components/product/AIMatchDashboard";
import { PRICING_FAQS } from "@/data/faqs";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Nonni's core matching and placement service is $0 cost to families. Search, get RN-reviewed matches, and connect with verified providers at no cost to you.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        tone="dark"
        title="Placement is $0 cost to families"
        description="Our core matching and placement service is free for families. Search the directory, receive RN-reviewed matches, and connect with verified providers — all at no cost to you."
        primary={{ label: "Find Care", href: "/families#find-a-bed" }}
        secondary={{ label: "List Your Beds", href: "/providers#list-your-beds" }}
        stats={[
          { v: "$0", l: "Cost to families" },
          { v: "RN-led", l: "Every match reviewed" },
          { v: "45d", l: "RN follow-up after move-in" },
        ]}
        media={
          <div className="hidden lg:block">
            <AIMatchDashboard />
          </div>
        }
      />
      <PricingSection id="pricing-tables" />
      <FaqSection items={PRICING_FAQS} tone="ice" description="How placement works for families, in plain terms." />
      <FinalCTA />
    </>
  );
}
