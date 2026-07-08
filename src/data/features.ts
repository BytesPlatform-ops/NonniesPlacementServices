import type { LucideIcon } from "lucide-react";
import {
  Stethoscope,
  Brain,
  BadgeDollarSign,
  Sparkles,
  Handshake,
  Network,
  Building2,
  Truck,
} from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Differentiators — the deck's 5 core (slide 5) plus platform strengths. */
export const DIFFERENTIATORS: Feature[] = [
  {
    icon: Stethoscope,
    title: "Clinical expertise",
    description:
      "A dedicated pool of Registered Nurse consultants conducts every assessment. This goes well beyond standard placement services.",
  },
  {
    icon: Brain,
    title: "Niche specialization",
    description:
      "Deep experience across complex psychiatric & behavioral-health populations, medication management, chronic illness, and care transitions.",
  },
  {
    icon: BadgeDollarSign,
    title: "Zero $ cost to families",
    description:
      "Placement to our vast network of long-term and respite care providers is free for families seeking care.",
  },
  {
    icon: Sparkles,
    title: "Tailored matching",
    description:
      "We match the unique, specialized needs of each client with professional providers adapted to those specific needs.",
  },
  {
    icon: Handshake,
    title: "Trusted community partner",
    description:
      "We align workflows and communication with hospitals, communities, providers, and families to optimize the whole experience.",
  },
  {
    icon: Network,
    title: "Two-sided network",
    description:
      "One platform connects families, hospitals, and providers — so the right beds and the right needs actually find each other.",
  },
  {
    icon: Building2,
    title: "Provider visibility",
    description:
      "Communities showcase specialties, real-time availability, and pricing to reach seekers who are the right fit.",
  },
  {
    icon: Truck,
    title: "Transition coordination",
    description:
      "We coordinate the move itself, medication reconciliation, and post-placement follow-up — the hand-off families navigate alone.",
  },
];

export type Stat = { value: number; suffix?: string; prefix?: string; label: string };

/** Trust / social-proof stats for count-ups (§3.7). Grounded in the deck. */
export const TRUST_STATS: Stat[] = [
  { value: 100, suffix: "%", label: "Referrals RN-reviewed" },
  { value: 12, suffix: "", label: "Facility & care types" },
  { value: 39, suffix: "", label: "WA counties served" },
  { value: 0, prefix: "$", suffix: "", label: "Cost to families" },
];
