import type { Option } from "./careTypes";

/**
 * Data for the Secure Hospital Placement Portal (/hospital-referral).
 * A streamlined, single-screen referral intake for hospital case managers and
 * social workers operating under acute discharge timelines.
 */

/** Hospitals / corporate facilities referring professionals commonly work with. */
export const REFERRAL_HOSPITALS: Option[] = [
  { value: "multicare-tacoma-general", label: "MultiCare Tacoma General" },
  { value: "multicare-good-samaritan", label: "MultiCare Good Samaritan" },
  { value: "providence", label: "Providence" },
  { value: "swedish", label: "Swedish" },
  { value: "harborview", label: "Harborview" },
  { value: "st-joseph", label: "St. Joseph" },
  { value: "st-anthony", label: "St. Anthony" },
  { value: "st-clare", label: "St. Clare" },
  { value: "virginia-mason", label: "Virginia Mason" },
  { value: "other", label: "Other" },
];

/** A selectable option that carries a short clinical description. */
export type DriverOption = { value: string; label: string; description: string };

/** Discharge urgency status (single-select). */
export const DISCHARGE_URGENCY: DriverOption[] = [
  {
    value: "urgent",
    label: "Urgent Case",
    description: "Discharge scheduled within 24–48 hours.",
  },
  {
    value: "standard",
    label: "Standard Case",
    description: "Step-down or alternate level of care placement planning (3+ days out).",
  },
];

/** Required care destination type (multi-select — select best fit). */
export const CARE_DESTINATIONS: DriverOption[] = [
  {
    value: "memory-care",
    label: "Memory Care — Dementia & Alzheimer's",
    description: "Advanced dementia / Alzheimer's requiring a secured perimeter layout.",
  },
  {
    value: "behavioral-health",
    label: "Mental & Behavioral Health",
    description: "Active psychiatric diagnoses, history of exit-seeking, or combativeness during care actions.",
  },
  {
    value: "adult-family-home",
    label: "Adult Family Home (AFH)",
    description: "Residential 6-bed high-acuity environment.",
  },
  {
    value: "assisted-living-respite",
    label: "Assisted Living / Respite",
    description: "Light to moderate physical Activities of Daily Living (ADLs) assistance.",
  },
];

/** Financial status routing (multi-select). */
export const FINANCIAL_ROUTING: DriverOption[] = [
  {
    value: "medicaid-active",
    label: "Straight Medicaid Active",
    description: "COPES / LTC programs cross-validated.",
  },
  {
    value: "medicaid-pending",
    label: "Medicaid Pending",
    description: "Documented financial asset spend-down in progress.",
  },
  {
    value: "medicare-days",
    label: "Medicare Days Remaining",
    description: "Post-acute short-term rehab transition.",
  },
  {
    value: "private-pay",
    label: "Private Pay Verified",
    description: "Complete private family funds available.",
  },
  {
    value: "other",
    label: "Other",
    description: "Financial situation not listed above.",
  },
];

/** Patient gender (single-select). */
export const PATIENT_GENDERS: Option[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary / Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

/** Mobility / transfer support level (single-select). */
export const MOBILITY_LEVELS: Option[] = [
  { value: "independent", label: "Walks independently" },
  { value: "device-independent", label: "Uses walker / wheelchair independently" },
  { value: "assist-1", label: "Requires 1-person assist to stand / transfer" },
  { value: "assist-2", label: "Requires 2-person assist or mechanical (Hoyer) lift" },
  { value: "bedbound", label: "Bedbound" },
];

/** ADL (Activities of Daily Living) assistance level (single-select). */
export const ADL_LEVELS: Option[] = [
  { value: "independent", label: "Independent" },
  { value: "minimal", label: "Minimal assistance" },
  { value: "moderate", label: "Moderate assistance" },
  { value: "extensive", label: "Extensive assistance" },
  { value: "total", label: "Total care" },
];

/** Generic Yes / No / Unsure options for quick clinical toggles. */
export const YES_NO_UNSURE: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure" },
];

/** Skilled nursing needs (multi-select). */
export const NURSING_NEEDS: Option[] = [
  { value: "insulin", label: "Insulin / sliding-scale management" },
  { value: "wound-care", label: "Wound care (Stage 2–4)" },
  { value: "catheter", label: "Catheter / ostomy care" },
  { value: "oxygen", label: "Continuous oxygen" },
  { value: "cpap", label: "CPAP / BiPAP" },
  { value: "tube-feeding", label: "Tube feeding (G-tube)" },
  { value: "hospice", label: "Hospice / palliative comfort care" },
  { value: "other", label: "Other" },
];

/** Cognitive / dementia status (single-select). */
export const COGNITIVE_STATUS: Option[] = [
  { value: "intact", label: "Alert & oriented — no impairment" },
  { value: "mild", label: "Mild cognitive impairment" },
  { value: "moderate-dementia", label: "Moderate dementia" },
  { value: "advanced-dementia", label: "Advanced dementia / Alzheimer's" },
  { value: "undiagnosed", label: "Undiagnosed memory loss" },
];

/** Behavioral & safety concerns (multi-select). */
export const BEHAVIORAL_CONCERNS: Option[] = [
  { value: "none", label: "None" },
  { value: "exit-seeking", label: "Exit-seeking / wandering" },
  { value: "sundowning", label: "Sundowning" },
  { value: "verbal-aggression", label: "Verbal aggression" },
  { value: "physical-aggression", label: "Physical aggression" },
  { value: "hallucinations", label: "Hallucinations / delusions" },
  { value: "hoarding", label: "Hoarding / shadowing" },
];

/** Assistive devices (multi-select — shown when fall risk is present). */
export const ASSISTIVE_DEVICES: Option[] = [
  { value: "cane", label: "Cane" },
  { value: "walker", label: "Walker" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "gait-belt", label: "Gait belt" },
  { value: "bed-chair-alarm", label: "Bed / chair alarm" },
  { value: "grab-bars", label: "Grab bars / rails" },
];

/** Private / shared room preference (single-select). */
export const ROOM_PREFERENCES: Option[] = [
  { value: "private", label: "Private room" },
  { value: "shared", label: "Shared room" },
  { value: "either", label: "No preference" },
];

/** Estimated private-pay monthly budget (single-select; shown for private pay). */
export const PRIVATE_PAY_BUDGETS: Option[] = [
  { value: "under-4k", label: "Under $4,000 / mo" },
  { value: "4k-6k", label: "$4,000 – $6,000 / mo" },
  { value: "6k-8k", label: "$6,000 – $8,000 / mo" },
  { value: "8k-plus", label: "$8,000+ / mo" },
];

/** Relationship of the guardian / POA / family contact (single-select). */
export const GUARDIAN_RELATIONSHIPS: Option[] = [
  { value: "family", label: "Family member" },
  { value: "poa", label: "Power of Attorney (POA)" },
  { value: "guardian", label: "Legal guardian" },
  { value: "self", label: "Self / patient" },
  { value: "other", label: "Other" },
];

/** Recommended documents that expedite RN clinical review. */
export const RECOMMENDED_UPLOADS = [
  "Hospital History & Physical (H&P)",
  "Current Medication Administration Record (MAR)",
  "PASRR Level 1 evaluation",
  "Physical / Occupational Therapy mobility notes",
];
