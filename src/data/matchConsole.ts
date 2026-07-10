export const matchProfile = {
  caseId: "Case #WA-2048",
  careLevel: "Heavy care · memory",
  funding: "Medicaid + private",
  location: "Tacoma, WA · 15 mi radius",
  urgency: "Hospital discharge · 3 days",
  note: "RN review complete — cleared to connect",
};

/** Specialty needs surfaced on the care profile (visible chips). */
export const matchSpecialtyNeeds = [
  "Alzheimer's support",
  "Behavioral Health",
  "Wandering risk",
  "Medication protocol",
];

export type MatchResult = {
  score: number;
  name: string;
  detail: string;
  badge?: string;
  /** Why this provider fits — visible specialty reason tags. */
  reasons: string[];
};

export const matchResults: MatchResult[] = [
  { score: 92, name: "Cedar Grove Adult Family H…", detail: "Memory care · Private · 6 mi", badge: "Best", reasons: ["Alzheimer's Care", "Behavioral Health", "Psychiatric Support"] },
  { score: 87, name: "Harborlight Assisted Living", detail: "Assisted living · Medicaid · 9 mi", reasons: ["Dementia", "Medication support"] },
  { score: 81, name: "Rainier Skilled Nursing", detail: "Skilled nursing · Medicare · 12 mi", reasons: ["Psychiatric Support", "Specialized medication protocols"] },
];

/** Placement progress rail — first 3 done, provider matching active, rest pending. */
export const progressSteps: { label: string; state: "done" | "active" | "pending" }[] = [
  { label: "Family intake", state: "done" },
  { label: "RN assessment", state: "done" },
  { label: "Care needs parsed", state: "done" },
  { label: "Finding the fit", state: "active" },
  { label: "Tour coordination", state: "pending" },
  { label: "Move-in support", state: "pending" },
];
