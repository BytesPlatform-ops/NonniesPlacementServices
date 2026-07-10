export type GalleryCardType =
  | "document"
  | "review"
  | "ui"
  | "ranking"
  | "calendar"
  | "care"
  | "progress";

export type PlacementGalleryCard = {
  title: string;
  caption: string;
  type: GalleryCardType;
  /** Optional media for photographic card types (from the user's `new/` folder). */
  image?: string;
  /** Layout hint for the horizontal deck — larger cards anchor the composition. */
  size?: "sm" | "md" | "lg";
};

const NEW = "/assets/new";

export const placementGallery: PlacementGalleryCard[] = [
  { title: "Referral arrives", caption: "Care needs, memory & behavioral history captured clearly.", type: "document", size: "md" },
  { title: "RN review", caption: "Memory, behavioral & medication needs reviewed first.", type: "review", image: `${NEW}/pexels-tima-miroshnichenko-6010874.jpg`, size: "lg" },
  { title: "Match console", caption: "Specialty care-fit options ranked in real time.", type: "ui", size: "md" },
  { title: "Provider shortlist", caption: "Top 3 dementia & behavioral-fit options, compared.", type: "ranking", size: "md" },
  { title: "Tour coordination", caption: "Calls, visits, and admission steps stay aligned.", type: "calendar", size: "sm" },
  { title: "Move-in support", caption: "Follow-up protects the placement after move-in.", type: "care", image: `${NEW}/pexels-fernando-capetillo-94107723-38167593.jpg`, size: "lg" },
  { title: "Case progress", caption: "Everyone knows what step is next.", type: "progress", size: "md" },
];
