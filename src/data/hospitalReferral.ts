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
];

/** Recommended documents that expedite RN clinical review. */
export const RECOMMENDED_UPLOADS = [
  "Hospital History & Physical (H&P)",
  "Current Medication Administration Record (MAR)",
  "PASRR Level 1 evaluation",
  "Physical / Occupational Therapy mobility notes",
];
