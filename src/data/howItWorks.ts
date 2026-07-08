import type { LucideIcon } from "lucide-react";
import { ClipboardList, Stethoscope, Sparkles, CalendarCheck, HeartHandshake } from "lucide-react";

export type Accent = "copper" | "brown" | "gold" | "tan";

export type HowItWorksStep = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
};

/** "How it works" — five coordinated placement steps (RN-led). */
export const howItWorksSteps: HowItWorksStep[] = [
  {
    step: "01",
    title: "Referral & intake",
    description:
      "A family, hospital discharge planner, social worker, or case manager shares the situation — care level, location, funding, and timing. No jargon required.",
    icon: ClipboardList,
    accent: "copper",
  },
  {
    step: "02",
    title: "RN clinical assessment",
    description:
      "A Registered Nurse reviews diagnoses, functional ability, behavioral concerns, mobility, safety risks, and medications — building an accurate care picture that drives the plan.",
    icon: Stethoscope,
    accent: "brown",
  },
  {
    step: "03",
    title: "Intelligent matching",
    description:
      "The platform identifies communities that meet the clinical, behavioral, financial, geographic, and cultural criteria — generating 5 options and ranking the top 3.",
    icon: Sparkles,
    accent: "gold",
  },
  {
    step: "04",
    title: "Tours & coordination",
    description:
      "Pre-visit calls, virtual and physical tours, and admission are coordinated with synced calendars across hospitals, communities, and families.",
    icon: CalendarCheck,
    accent: "tan",
  },
  {
    step: "05",
    title: "Placement & follow-up",
    description:
      "We ensure a seamless move-in, then continue post-placement support — up to 45 days of RN case management — to protect the longevity of the placement.",
    icon: HeartHandshake,
    accent: "copper",
  },
];

/** Accent → warm brand token classes (border, glow ring, number tint, icon chip). */
export const ACCENT_STYLES: Record<Accent, { ring: string; num: string; chip: string; line: string }> = {
  copper: { ring: "border-coral/60 shadow-[0_28px_70px_-30px_rgba(181,111,40,0.55)]", num: "text-coral/15", chip: "bg-coral/12 text-coral", line: "bg-coral" },
  brown: { ring: "border-navy/50 shadow-[0_28px_70px_-30px_rgba(71,46,22,0.5)]", num: "text-navy/12", chip: "bg-navy/10 text-navy", line: "bg-navy" },
  gold: { ring: "border-mint/60 shadow-[0_28px_70px_-30px_rgba(209,143,71,0.6)]", num: "text-mint/20", chip: "bg-mint/15 text-[#a9741f]", line: "bg-mint" },
  tan: { ring: "border-[#c69a5c]/60 shadow-[0_28px_70px_-30px_rgba(198,154,92,0.5)]", num: "text-[#8E6D49]/15", chip: "bg-[#c69a5c]/15 text-[#8E6D49]", line: "bg-[#c69a5c]" },
};
