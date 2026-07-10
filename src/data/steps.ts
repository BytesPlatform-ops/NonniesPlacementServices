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
    title: "RN care assessment",
    description:
      "A Registered Nurse reviews clinical diagnoses, memory care needs, tracking/wandering behaviors, mental health history, and specialized medication protocols to build an accurate care picture.",
    icon: Stethoscope,
  },
  {
    id: 3,
    eyebrow: "Step 03",
    title: "Matching Your Loved One's Unique Story",
    description:
      "We find communities that can truly help — matched on cognitive and behavioral needs, funding, location, and real availability — then surface 5 options and rank the strongest 3.",
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
    title: "Understanding the Whole Situation",
    description:
      "Care level, memory and behavioral needs, funding, location, bed availability, specialty, and available support — the whole picture becomes structured inputs.",
    icon: Database,
  },
  {
    id: 2,
    eyebrow: "Filtering",
    title: "Finding Options That Can Truly Help",
    description:
      "Hard constraints — funding accepted, care level and behavioral support needs supported, real bed availability, verified license — remove options that can't actually work.",
    icon: Filter,
  },
  {
    id: 3,
    eyebrow: "Finding the Strongest Options",
    title: "5 options → top 3 ranked",
    description:
      "Remaining communities are scored for a safer, more supportive fit, proximity, and preference alignment. The engine surfaces 5 options and ranks the strongest 3 — a shortlist, not a verdict.",
    icon: Gauge,
  },
  {
    id: 4,
    eyebrow: "A Nurse Reviews the Final Fit",
    title: "RN review — the final word",
    description:
      "A Registered Nurse reviews the shortlist before it reaches you. Intelligent matching supports the decision; it never replaces clinical judgment.",
    icon: UserCheck,
  },
];

export const AI_SIGNALS = [
  "Care level",
  "Mental & Behavioral Health",
  "Dementia",
  "Alzheimer's",
  "Memory care needs",
  "Wandering / tracking behaviors",
  "Psychiatric Support",
  "Medication protocols",
  "Facility type",
  "Location",
  "Bed availability",
  "Funding type",
  "Available support",
  "License validation",
  "RN review",
];
