export const matchProfile = {
  caseId: "Case #WA-2048",
  careLevel: "Heavy care · memory",
  funding: "Medicaid + private",
  location: "Tacoma, WA · 15 mi radius",
  urgency: "Hospital discharge · 3 days",
  note: "RN review complete — cleared to connect",
};

export type MatchResult = {
  score: number;
  name: string;
  detail: string;
  badge?: string;
};

export const matchResults: MatchResult[] = [
  { score: 92, name: "Cedar Grove Adult Family H…", detail: "Memory care · Private · 6 mi", badge: "Best" },
  { score: 87, name: "Harborlight Assisted Living", detail: "Assisted living · Medicaid · 9 mi" },
  { score: 81, name: "Rainier Skilled Nursing", detail: "Skilled nursing · Medicare · 12 mi" },
];

/** Placement progress rail — first 3 done, provider matching active, rest pending. */
export const progressSteps: { label: string; state: "done" | "active" | "pending" }[] = [
  { label: "Family intake", state: "done" },
  { label: "RN assessment", state: "done" },
  { label: "Care needs parsed", state: "done" },
  { label: "Provider matching", state: "active" },
  { label: "Tour coordination", state: "pending" },
  { label: "Move-in support", state: "pending" },
];
