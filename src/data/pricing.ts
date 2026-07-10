/**
 * Pricing content.
 *
 * Nonni's core matching and placement service is $0 cost to families. Paid
 * tiers and dollar amounts have been removed from the public site; only the
 * free Intro tier remains. The audience structure and types are retained so
 * the (currently hidden) pricing page can be brought back in the future.
 */

export type AudienceKey = "families" | "hospitals" | "communities";

export type Tier = {
  name: "Intro" | "Silver" | "Gold" | "Platinum";
  price: string;
  cadence: string;
  blurb: string;
  highlight?: boolean;
  features: string[];
};

export type PricingAudience = {
  key: AudienceKey;
  label: string;
  billing: string;
  tiers: Tier[];
};

const INTRO = [
  "HIPAA-compliant online profile",
  "Search the full provider directory",
  "List requests / available beds",
  "RN-reviewed matching",
];

// Free Intro tier only — every audience starts, and stays, at $0.
export const PRICING: PricingAudience[] = [
  {
    key: "families",
    label: "For Families",
    billing: "Our core matching and placement service is $0 cost to families.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "always free", blurb: "Search, get RN-reviewed matches, and receive outreach.", features: INTRO },
    ],
  },
  {
    key: "hospitals",
    label: "For Hospitals",
    billing: "List discharge needs and connect with verified providers.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "to start", blurb: "List discharge needs and connect.", features: INTRO },
    ],
  },
  {
    key: "communities",
    label: "For Communities",
    billing: "Get discovered by the right seekers.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "to start", blurb: "Get discovered by the right seekers.", features: INTRO },
    ],
  },
];
