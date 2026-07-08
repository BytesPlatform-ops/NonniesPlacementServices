/** Demo marketplace listings — FRONTEND DEMO DATA ONLY (no backend). */

export type Listing = {
  id: string;
  name: string;
  city: string;
  type: string;
  bedsAvailable: number;
  care: string[];
  funding: string[];
  matchScore: number;
  rnReviewed: boolean;
  price: string;
  image: string;
};

export const LISTINGS: Listing[] = [
  {
    id: "evergreen-afh",
    name: "Evergreen Adult Family Home",
    city: "Seattle, WA",
    type: "Adult Family Home",
    bedsAvailable: 2,
    care: ["Dementia", "Mobility support"],
    funding: ["Medicaid", "Private Pay"],
    matchScore: 94,
    rnReviewed: true,
    price: "$$",
    image: "/assets/images/caregiver-resident-room.jpg",
  },
  {
    id: "cedar-view",
    name: "Cedar View Memory Care",
    city: "Bellevue, WA",
    type: "Memory Care",
    bedsAvailable: 1,
    care: ["Alzheimer's", "Medication support"],
    funding: ["Private Insurance"],
    matchScore: 91,
    rnReviewed: true,
    price: "$$$",
    image: "/assets/images/care-lifestyle-1.jpg",
  },
  {
    id: "lakewood-al",
    name: "Lakewood Assisted Living",
    city: "Tacoma, WA",
    type: "Assisted Living",
    bedsAvailable: 4,
    care: ["Daily living", "Meals", "Activities"],
    funding: ["Private Pay"],
    matchScore: 88,
    rnReviewed: true,
    price: "$$$",
    image: "/assets/images/assisted-living-community.jpg",
  },
  {
    id: "harbor-respite",
    name: "Harbor Respite Care",
    city: "Everett, WA",
    type: "Respite Care",
    bedsAvailable: 3,
    care: ["Short-term relief"],
    funding: ["Private Pay"],
    matchScore: 86,
    rnReviewed: true,
    price: "$$",
    image: "/assets/images/senior-family-consultation.jpg",
  },
  {
    id: "northgate-snf",
    name: "Northgate Skilled Nursing",
    city: "Seattle, WA",
    type: "Skilled Nursing",
    bedsAvailable: 2,
    care: ["Rehab", "24-hour nursing"],
    funding: ["Medicare"],
    matchScore: 89,
    rnReviewed: true,
    price: "$$$$",
    image: "/assets/images/provider-staff.jpg",
  },
  {
    id: "harborlight-al",
    name: "Harborlight Assisted Living",
    city: "Tacoma, WA",
    type: "Assisted Living",
    bedsAvailable: 3,
    care: ["Daily living", "VA-friendly"],
    funding: ["Private Pay", "VA"],
    matchScore: 84,
    rnReviewed: true,
    price: "$$$",
    image: "/assets/images/provider-facility-care.jpg",
  },
];
