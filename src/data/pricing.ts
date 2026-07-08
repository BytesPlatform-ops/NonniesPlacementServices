/**
 * Pricing content — three separate structures, four ascending tiers each.
 * Numbers pulled directly from Design Research §7. Feature lists are
 * progressive: each tier includes everything below it. (§17)
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
  "Await outreach",
];
const SILVER_ADD = [
  "RN clinical assessment",
  "Digitized workflows — synced calendars & bookings",
  "Analytics — ETAs, fill rates & more",
  "Up to 3 AI-based matches",
  "Basic transition support",
];
const GOLD_ADD = [
  "Unlimited search & AI matching until placement",
  "Accompanied facility tours",
  "Medication reconciliation",
  "Move-in coordination",
  "30-day follow-up",
];
const PLATINUM_ADD = [
  "White-glove concierge placement",
  "Priority / dedicated support",
  "Coordination with hospitals, physicians & facilities",
  "45-day ongoing RN case management",
];

const silver = [...INTRO, ...SILVER_ADD];
const gold = [...silver, ...GOLD_ADD];
const platinum = [...gold, ...PLATINUM_ADD];

export const PRICING: PricingAudience[] = [
  {
    key: "families",
    label: "For Families",
    billing: "One-time service fee, billed only when you engage a plan.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "always free", blurb: "Start your search and receive outreach.", features: INTRO },
      { name: "Silver", price: "$1,500", cadence: "one-time", blurb: "RN assessment and guided matching.", features: silver },
      { name: "Gold", price: "$2,500", cadence: "one-time", blurb: "Hands-on placement with follow-up.", highlight: true, features: gold },
      { name: "Platinum", price: "$5,000", cadence: "one-time", blurb: "Full concierge care coordination.", features: platinum },
    ],
  },
  {
    key: "hospitals",
    label: "For Hospitals",
    billing: "Monthly subscription, scaled by number of facilities served.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "/mo", blurb: "List discharge needs and connect.", features: INTRO },
      { name: "Silver", price: "$500", cadence: "/mo", blurb: "Up to 5 facilities. RN-assisted flow.", features: silver },
      { name: "Gold", price: "$1,000", cadence: "/mo", blurb: "Up to 10 facilities. Full coordination.", highlight: true, features: gold },
      { name: "Platinum", price: "$1,500", cadence: "/mo", blurb: "10+ facilities. Dedicated case management.", features: platinum },
    ],
  },
  {
    key: "communities",
    label: "For Communities",
    billing: "Monthly subscription, billed per community you operate.",
    tiers: [
      { name: "Intro", price: "$0", cadence: "/mo/community", blurb: "Get discovered by the right seekers.", features: INTRO },
      { name: "Silver", price: "$50", cadence: "/mo/community", blurb: "Under 5 communities. Analytics + matches.", features: silver },
      { name: "Gold", price: "$70", cadence: "/mo/community", blurb: "Under 10 communities. Priority visibility.", highlight: true, features: gold },
      { name: "Platinum", price: "$100", cadence: "/mo/community", blurb: "10+ communities. Concierge coordination.", features: platinum },
    ],
  },
];
