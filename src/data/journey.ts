/** Frames for the sticky scroll-morph "Resident's Journey" gallery. */
export type JourneyFrame = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  microcopy: string;
  image: string;
  alt: string;
};

export const journeyFrames: JourneyFrame[] = [
  {
    id: "uncertainty",
    eyebrow: "The moment",
    title: "It starts with uncertainty",
    text: "A hospital call. A diagnosis. A family unsure where to turn.",
    microcopy: "You don't have to navigate the search — or the fear — alone.",
    image: "/assets/nonnis/specialty-care/family-placement-consultation.jpg",
    alt: "Family discussing care placement options together",
  },
  {
    id: "assessment",
    eyebrow: "RN assessment",
    title: "A nurse brings clarity",
    text: "A Registered Nurse listens, then translates the situation into a clear care plan.",
    microcopy: "Memory, behavioral, mobility, wandering, and medication needs — all reviewed.",
    image: "/assets/nonnis/specialty-care/rn-tablet-care-review.jpg",
    alt: "Registered Nurse reviewing care needs on a tablet",
  },
  {
    id: "match",
    eyebrow: "The match",
    title: "The right community, found",
    text: "We surface real openings matched to memory and behavioral needs — an RN clears the best fits.",
    microcopy: "Care level, funding, location, and a bed that's actually available.",
    image: "/assets/nonnis/specialty-care/provider-memory-care-room.jpg",
    alt: "Provider room prepared for memory care placement",
  },
  {
    id: "comfort",
    eyebrow: "Settled in",
    title: "Home, and cared for",
    text: "A calmer daily rhythm — with follow-up long after move-in.",
    microcopy: "Up to 45 days of RN case management once they're settled.",
    image: "/assets/nonnis/specialty-care/senior-safe-environment.jpg",
    alt: "An older adult settled safely in a warm care environment",
  },
];
