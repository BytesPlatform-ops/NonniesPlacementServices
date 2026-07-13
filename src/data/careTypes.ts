import type { LucideIcon } from "lucide-react";
import {
  Home,
  Building,
  Brain,
  Activity,
  HeartPulse,
  CalendarClock,
  Stethoscope,
  Hospital,
  Pill,
  Accessibility,
  ShieldPlus,
} from "lucide-react";

export type Option = { value: string; label: string };

/** Facility types — all 12 from the deck (slides 12 & 14). */
export const FACILITY_TYPES: Option[] = [
  { value: "adult-family-home", label: "Adult Family Home" },
  { value: "assisted-living", label: "Assisted Living" },
  { value: "behavioral-health", label: "Behavioral Health" },
  { value: "hospice", label: "Hospice" },
  { value: "ltac", label: "Long Term Acute Care" },
  { value: "memory-care", label: "Memory Care" },
  { value: "nursing-home", label: "Nursing Home" },
  { value: "psychiatric", label: "Psychiatric" },
  { value: "mental-health", label: "Mental Health" },
  { value: "rehabilitation", label: "Rehabilitation" },
  { value: "skilled-nursing", label: "Skilled Nursing" },
  { value: "urgent-care", label: "Urgent Care" },
];

/** Care levels — deck uses Heavy / Medium / Independent (slides 12 & 14). */
export const CARE_LEVELS: Option[] = [
  { value: "independent", label: "Independent" },
  { value: "medium", label: "Medium Care" },
  { value: "heavy", label: "Heavy Care" },
  { value: "memory", label: "Memory Care — Dementia & Alzheimer's" },
  { value: "behavioral", label: "Mental & Behavioral Health" },
  { value: "unsure", label: "Unsure — help me decide" },
];

/** Funding / payment types (deck: Private, Medicaid, Medicare). */
export const FUNDING_TYPES: Option[] = [
  { value: "private", label: "Private pay" },
  { value: "medicaid", label: "Medicaid" },
  { value: "medicare", label: "Medicare" },
  { value: "va", label: "VA benefits" },
  { value: "ltc-insurance", label: "Long-term care insurance" },
  { value: "unsure", label: "Unsure" },
];

export const BED_PREFERENCES: Option[] = [
  { value: "single", label: "Single / private" },
  { value: "shared", label: "Shared" },
  { value: "either", label: "Either is fine" },
];

export const TIMELINES: Option[] = [
  { value: "urgent", label: "Urgent — hospital discharge in days" },
  { value: "soon", label: "Soon — within 2 weeks" },
  { value: "month", label: "This month" },
  { value: "planning", label: "Planning ahead" },
];

export const BED_TYPES: Option[] = [
  { value: "single", label: "Single / private" },
  { value: "shared", label: "Shared" },
];

/**
 * Standardized specialties a community can offer — presented as checkboxes on
 * the provider intake form so listings are structured and comparable (rather
 * than free text). Mirrors the referral portal's standardized-options approach.
 */
export const PROVIDER_SPECIALTIES: Option[] = [
  { value: "mental-behavioral-health", label: "Mental & Behavioral Health" },
  { value: "dementia", label: "Dementia" },
  { value: "alzheimers", label: "Alzheimer's" },
  { value: "memory-care", label: "Memory Care" },
  { value: "psychiatric", label: "Psychiatric / mental health" },
  { value: "skilled-nursing", label: "Skilled nursing" },
  { value: "hospice", label: "Hospice / end-of-life" },
  { value: "respite", label: "Respite / short-term" },
  { value: "diabetic-care", label: "Diabetic care" },
  { value: "medication-management", label: "Medication management" },
  { value: "mobility-fall-risk", label: "Mobility / fall-risk support" },
  { value: "bariatric", label: "Bariatric care" },
];

export type CareTypeCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  image?: string;
};

/** Curated care-type cards for the image-rich grid (§Care types). */
export const CARE_TYPE_CARDS: CareTypeCard[] = [
  { icon: Home, title: "Adult Family Home", description: "Small, licensed residential homes offering personalized assistance and supervision in a home-like setting.", image: "/assets/images/caregiver-resident-room.jpg" },
  { icon: Building, title: "Assisted Living", description: "Supportive communities for people who need help with daily activities while keeping their independence.", image: "/assets/images/assisted-living-community.jpg" },
  { icon: Brain, title: "Memory Care — Dementia & Alzheimer's", description: "Secured, specialized care for Alzheimer's and other forms of dementia, with trained staff and structured routines." },
  { icon: Activity, title: "Skilled Nursing", description: "24-hour licensed nursing for higher-acuity medical needs and rehabilitation." },
  { icon: HeartPulse, title: "Hospice", description: "Comfort-focused, dignified care for end-of-life — centered on the person and their family.", image: "/assets/images/elderly-hands-care.jpg" },
  { icon: ShieldPlus, title: "Mental & Behavioral Health", description: "Placements experienced with schizophrenia, bipolar, PTSD, depression, and substance-use recovery." },
  { icon: Brain, title: "Psychiatric & Mental Health", description: "Communities equipped for complex psychiatric and mental-health needs, matched with clinical review." },
  { icon: Hospital, title: "Long Term Acute Care", description: "Extended acute medical care for patients recovering from serious illness or injury." },
  { icon: Accessibility, title: "Rehabilitation", description: "Short-term rehab settings that restore strength, mobility, and independence after a hospital stay." },
  { icon: CalendarClock, title: "Respite Care", description: "Short-term stays that give family caregivers a planned, supported break." },
  { icon: Stethoscope, title: "Nursing Home", description: "Full-service nursing communities for ongoing medical and personal care needs." },
  { icon: Pill, title: "Urgent Care Transitions", description: "Fast placement support for urgent hospital discharges and specialized medical transport." },
];

/** Clinical conditions Nonni's places for (deck slide 3). */
export const CLINICAL_CONDITIONS = [
  "Mental & Behavioral Health",
  "Dementia",
  "Alzheimer's",
  "Medication management",
  "Diabetes management",
  "Mobility assistance",
  "Fall-risk precautions",
  "Chronic disease management",
  "Hospice support",
  "Complex care coordination",
];

export const BEHAVIORAL_CONDITIONS = [
  "Schizophrenia",
  "Bipolar disorder",
  "Depression & anxiety",
  "PTSD",
  "Cognitive impairment",
  "Dementia-related behaviors",
  "Developmental challenges",
  "Substance-use recovery",
];
