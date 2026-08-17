import type { Option } from "./careTypes";

/**
 * Data for the Secure Hospital Placement Portal (/hospital-referral).
 * A detailed RN-led referral intake for hospital case managers and social
 * workers — multi-select where useful, with conditional follow-ups.
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

/* -------------------------------------------------------------------------- */
/* 1. Referring Professional                                                  */
/* -------------------------------------------------------------------------- */

/** Discharge urgency window (single-select). */
export const URGENCY_LEVELS: Option[] = [
  { value: "same-day", label: "Same Day" },
  { value: "24-48h", label: "24–48 Hours" },
  { value: "3-7d", label: "3–7 Days" },
  { value: "1-2w", label: "1–2 Weeks" },
  { value: "flexible", label: "Flexible" },
];

/* -------------------------------------------------------------------------- */
/* 2. Patient Information                                                      */
/* -------------------------------------------------------------------------- */

/** Patient gender (single-select). */
export const PATIENT_GENDERS: Option[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary / Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

/* -------------------------------------------------------------------------- */
/* 3. Level of Care Needed (multi-select)                                     */
/* -------------------------------------------------------------------------- */

export const LEVELS_OF_CARE: Option[] = [
  { value: "afh", label: "Adult Family Home" },
  { value: "assisted-living", label: "Assisted Living" },
  { value: "memory-care", label: "Memory Care" },
  { value: "behavioral-health", label: "Behavioral / Mental Health" },
  { value: "skilled-nursing", label: "Skilled Nursing" },
  { value: "respite", label: "Respite / Short-Term" },
  { value: "enhanced-acuity", label: "Enhanced / High-Acuity Care" },
  { value: "needs-assessment", label: "Unsure – Needs Assessment" },
  { value: "other", label: "Other" },
];

/* -------------------------------------------------------------------------- */
/* 4. Diagnosis / Clinical Information                                         */
/* -------------------------------------------------------------------------- */

/** Notable clinical conditions (multi-select flags). */
export const CLINICAL_CONDITIONS: Option[] = [
  { value: "dementia", label: "Dementia / Alzheimer's" },
  { value: "mental-health", label: "Mental health diagnosis" },
  { value: "developmental", label: "Developmental / intellectual disability" },
  { value: "substance-use", label: "Substance-use concerns / history" },
];

/* -------------------------------------------------------------------------- */
/* 5. Mobility & ADLs                                                         */
/* -------------------------------------------------------------------------- */

/** ADL areas — each scored on the ASSIST levels below. `value` is the field name. */
export const ADL_AREAS: Option[] = [
  { value: "adlAmbulation", label: "Ambulation" },
  { value: "adlTransfers", label: "Transfers" },
  { value: "adlBathing", label: "Bathing" },
  { value: "adlDressing", label: "Dressing" },
  { value: "adlToileting", label: "Toileting" },
  { value: "adlGrooming", label: "Grooming" },
  { value: "adlEating", label: "Eating / feeding" },
];

/** Assistance level for each ADL area (single-select per area). */
export const ADL_ASSIST_LEVELS: Option[] = [
  { value: "independent", label: "Independent" },
  { value: "supervision", label: "Supervision" },
  { value: "partial", label: "Partial Assist" },
  { value: "total", label: "Total Assist" },
];

/** Mobility equipment / status (multi-select). */
export const MOBILITY_EQUIPMENT: Option[] = [
  { value: "walker", label: "Walker" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "cane", label: "Cane" },
  { value: "hoyer", label: "Hoyer / mechanical lift" },
  { value: "one-person", label: "One-person assist" },
  { value: "two-person", label: "Two-person assist" },
  { value: "fall-risk", label: "Fall risk" },
  { value: "non-ambulatory", label: "Non-ambulatory / bedbound" },
  { value: "incontinence", label: "Incontinence" },
];

/* -------------------------------------------------------------------------- */
/* 6. Nursing / Medical Needs                                                 */
/* -------------------------------------------------------------------------- */

/** Nurse delegation status (single-select; drives the nursing-needs reveal). */
export const NURSE_DELEGATION_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure / Needs RN Review" },
];

/** Specific nursing / medical care needs (multi-select). */
export const NURSING_NEEDS: Option[] = [
  { value: "medication-admin", label: "Medication administration" },
  { value: "blood-glucose", label: "Blood glucose monitoring" },
  { value: "insulin", label: "Insulin" },
  { value: "other-injections", label: "Other injections" },
  { value: "wound-care", label: "Wound care" },
  { value: "catheter", label: "Catheter care" },
  { value: "ostomy", label: "Ostomy care" },
  { value: "oxygen", label: "Oxygen" },
  { value: "cpap", label: "CPAP / BiPAP" },
  { value: "nebulizer", label: "Nebulizer" },
  { value: "tube-feeding", label: "Tube feeding" },
  { value: "special-diet", label: "Special diet" },
  { value: "aspiration", label: "Aspiration precautions" },
  { value: "seizure", label: "Seizure precautions" },
  { value: "other", label: "Other" },
];

/* -------------------------------------------------------------------------- */
/* 7. Behavioral / Safety Needs                                               */
/* -------------------------------------------------------------------------- */

export const BEHAVIORAL_CONCERNS: Option[] = [
  { value: "none", label: "None" },
  { value: "wandering", label: "Wandering / elopement" },
  { value: "verbal-aggression", label: "Verbal aggression" },
  { value: "physical-aggression", label: "Physical aggression" },
  { value: "sexual-inappropriate", label: "Sexual / inappropriate behaviors" },
  { value: "med-refusal", label: "Medication refusal" },
  { value: "self-harm", label: "Self-harm / suicide risk" },
  { value: "exit-seeking", label: "Exit seeking" },
  { value: "substance-use", label: "Substance-use concerns" },
  { value: "restraints", label: "Recent restraints / seclusion" },
  { value: "other", label: "Other" },
];

/** Current supervision level (single-select). */
export const SUPERVISION_LEVELS: Option[] = [
  { value: "routine", label: "Routine" },
  { value: "enhanced", label: "Enhanced supervision" },
  { value: "line-of-sight", label: "Line-of-sight" },
  { value: "1-1", label: "1:1" },
];

/* -------------------------------------------------------------------------- */
/* 8. Funding (multi-select)                                                  */
/* -------------------------------------------------------------------------- */

export const FUNDING_OPTIONS: Option[] = [
  { value: "medicaid-pending", label: "Medicaid Pending" },
  { value: "private-pay", label: "Private Pay" },
  { value: "ltc-insurance", label: "Long-Term Care Insurance" },
  { value: "va", label: "VA Benefits" },
  { value: "other", label: "Other" },
  { value: "undetermined", label: "Funding Undetermined" },
];

/** Estimated private-pay monthly budget (shown when Private Pay is selected). */
export const PRIVATE_PAY_BUDGETS: Option[] = [
  { value: "under-4k", label: "Under $4,000 / mo" },
  { value: "4k-6k", label: "$4,000 – $6,000 / mo" },
  { value: "6k-8k", label: "$6,000 – $8,000 / mo" },
  { value: "8k-plus", label: "$8,000+ / mo" },
];

/* -------------------------------------------------------------------------- */
/* 9. Decision-Making / Contacts                                              */
/* -------------------------------------------------------------------------- */

/** Generic Yes / No / Unsure (patient decision-making capacity). */
export const YES_NO_UNSURE: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure" },
];

/** Patient / family awareness of the referral (single-select). */
export const AWARENESS_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "pending", label: "Pending" },
];

/* -------------------------------------------------------------------------- */
/* 10. Placement Preferences                                                  */
/* -------------------------------------------------------------------------- */

/** Private / shared room preference (single-select). */
export const ROOM_PREFERENCES: Option[] = [
  { value: "private-required", label: "Private room required" },
  { value: "private-preferred", label: "Private preferred" },
  { value: "shared-acceptable", label: "Shared room acceptable" },
  { value: "no-preference", label: "No preference" },
];

/** Additional placement features (multi-select). */
export const PLACEMENT_FEATURES: Option[] = [
  { value: "wheelchair-accessible", label: "Wheelchair accessibility" },
  { value: "non-smoking-env", label: "Non-smoking environment" },
];

/** Patient smoking status (single-select). */
export const SMOKING_STATUS: Option[] = [
  { value: "non-smoker", label: "Non-smoker" },
  { value: "smoker", label: "Smoker" },
  { value: "na", label: "N/A" },
];

/** Provider gender preference, if applicable (single-select). */
export const GENDER_PREFERENCE: Option[] = [
  { value: "no-preference", label: "No preference" },
  { value: "female-only", label: "Female-only setting" },
  { value: "male-only", label: "Male-only setting" },
  { value: "other", label: "Other" },
];

/* -------------------------------------------------------------------------- */
/* 11. Document Upload                                                        */
/* -------------------------------------------------------------------------- */

/** Document types planners may attach (also used as the uploader hint). */
export const DOCUMENT_TYPES: Option[] = [
  { value: "face-sheet", label: "Face Sheet" },
  { value: "hp", label: "H&P" },
  { value: "mar", label: "Medication List / MAR" },
  { value: "nursing-notes", label: "Nursing Notes" },
  { value: "discharge-summary", label: "Discharge Summary" },
  { value: "pt-ot", label: "PT / OT Evaluations" },
  { value: "behavioral-assessment", label: "Behavioral / Psychiatric Assessment" },
  { value: "dshs-care", label: "DSHS / CARE Assessment" },
  { value: "guardianship", label: "Guardianship / DPOA" },
  { value: "other", label: "Other relevant records" },
];

/** Recommended documents that expedite RN clinical review. */
export const RECOMMENDED_UPLOADS = [
  "Face Sheet",
  "H&P",
  "Medication List / MAR",
  "Nursing Notes",
  "Discharge Summary",
  "PT / OT Evaluations",
];
