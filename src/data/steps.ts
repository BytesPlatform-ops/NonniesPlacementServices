import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Stethoscope,
  Sparkles,
  CalendarCheck,
  HeartHandshake,
  Database,
  Filter,
  Gauge,
  UserCheck,
} from "lucide-react";

export type Step = {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

/** "How it works" — client-facing view of the deck's RN-led workflow (slide 4). */
export const HOW_IT_WORKS: Step[] = [
  {
    id: 1,
    eyebrow: "Step 01",
    title: "Referral & intake",
    description:
      "A family, hospital discharge planner, social worker, or case manager shares the situation — care level, location, funding, and timing. No jargon required.",
    icon: ClipboardList,
  },
  {
    id: 2,
    eyebrow: "Step 02",
    title: "RN clinical assessment",
    description:
      "A Registered Nurse reviews diagnoses, functional ability, behavioral concerns, mobility, safety risks, and medications — building an accurate care picture that drives the plan.",
    icon: Stethoscope,
  },
  {
    id: 3,
    eyebrow: "Step 03",
    title: "Intelligent matching",
    description:
      "The platform identifies communities that meet the clinical, behavioral, financial, geographic, and cultural criteria — generating 5 options and ranking the top 3.",
    icon: Sparkles,
  },
  {
    id: 4,
    eyebrow: "Step 04",
    title: "Tours & coordination",
    description:
      "Pre-visit calls, virtual and physical tours, and admission are coordinated with synced calendars across hospitals, communities, and families.",
    icon: CalendarCheck,
  },
  {
    id: 5,
    eyebrow: "Step 05",
    title: "Placement & follow-up",
    description:
      "We ensure a seamless move-in, then continue post-placement support — up to 45 days of RN case management — to protect the longevity of the placement.",
    icon: HeartHandshake,
  },
];

/** "How AI matching works" — the deck's back-end assessment & recommendation (slides 15–16). */
export const AI_PIPELINE: Step[] = [
  {
    id: 1,
    eyebrow: "Inputs",
    title: "Structured signals in",
    description:
      "Clinical, socioeconomic, geographic, and demographic data — care level, funding, location, bed availability, specialty, and provider capacity — become structured inputs.",
    icon: Database,
  },
  {
    id: 2,
    eyebrow: "Filtering",
    title: "Fit & eligibility filtering",
    description:
      "Hard constraints — funding accepted, care level and behavioral needs supported, real bed availability, verified license — remove options that can't actually work.",
    icon: Filter,
  },
  {
    id: 3,
    eyebrow: "Scoring",
    title: "5 options → top 3 ranked",
    description:
      "Remaining communities are scored for clinical fit, proximity, and preference alignment. The engine surfaces 5 options and ranks the strongest 3 — a shortlist, not a verdict.",
    icon: Gauge,
  },
  {
    id: 4,
    eyebrow: "Human layer",
    title: "RN review — the final word",
    description:
      "A Registered Nurse reviews the shortlist before it reaches you. Intelligent matching supports the decision; it never replaces clinical judgment.",
    icon: UserCheck,
  },
];

export const AI_SIGNALS = [
  "Care level",
  "Behavioral needs",
  "Medication needs",
  "Facility type",
  "Location",
  "Bed availability",
  "Funding type",
  "Provider capacity",
  "License validation",
  "Pricing",
  "RN review",
];
