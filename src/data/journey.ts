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
    image: "/assets/images/elderly-hands-care.jpg",
    alt: "A family member holding an older person's hand",
  },
  {
    id: "assessment",
    eyebrow: "RN assessment",
    title: "A nurse brings clarity",
    text: "A Registered Nurse listens, then translates the situation into a clear care plan.",
    microcopy: "Behavioral and medical needs, mobility, medication — all reviewed.",
    image: "/assets/images/nurse-tablet-care-plan.jpg",
    alt: "A nurse assessing a resident's care needs",
  },
  {
    id: "match",
    eyebrow: "The match",
    title: "The right community, found",
    text: "Intelligent matching surfaces real openings — an RN clears the best fits.",
    microcopy: "Care level, funding, location, and a bed that's actually available.",
    image: "/assets/images/assisted-living-community.jpg",
    alt: "A warm care community room",
  },
  {
    id: "comfort",
    eyebrow: "Settled in",
    title: "Home, and cared for",
    text: "A calmer daily rhythm — with follow-up long after move-in.",
    microcopy: "Up to 45 days of RN case management once they're settled.",
    image: "/assets/images/hero-family-goldenhour.jpg",
    alt: "An older person settled and cared for, with family",
  },
];
