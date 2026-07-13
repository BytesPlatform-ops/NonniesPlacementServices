export type NavLink = { label: string; href: string };

// The /pricing route is intentionally omitted from public navigation — the page
// component is retained in the codebase for future use but is not linked here.
export const NAV_LINKS: NavLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "For Families", href: "/families" },
  { label: "For Providers", href: "/providers" },
  { label: "Home Health Care", href: "/home-health-care" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const PRIMARY_CTA = { label: "Find Care", href: "/families#find-a-bed" };
export const SECONDARY_CTA = { label: "List Your Beds", href: "/providers#list-your-beds" };

// Dedicated professional funnel — secure hospital placement portal for case
// managers and discharge planners.
export const REFERRAL_CTA = { label: "Submit a Facilities Referral", href: "/hospital-referral" };

// Click-to-call RN CTA — `tel:` href launches the native dialer on mobile.
export const RN_PHONE = { label: "Talk to an RN Now", tel: "2065318890", href: "tel:2065318890" };

export const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "AI-assisted matching", href: "/#ai-matching" },
      { label: "Browse communities", href: "/#browse" },
      { label: "Find Care", href: "/families#find-a-bed" },
    ],
  },
  {
    title: "Who we serve",
    links: [
      { label: "For Families", href: "/families" },
      { label: "For Providers", href: "/providers" },
      { label: "For Hospitals", href: "/providers#discharge" },
      { label: "Discharge planners", href: "/providers#discharge" },
    ],
  },
  {
    title: "Care types",
    links: [
      { label: "Adult Family Homes", href: "/families#care-types" },
      { label: "Assisted Living", href: "/families#care-types" },
      { label: "Memory Care", href: "/families#care-types" },
      { label: "Skilled Nursing", href: "/families#care-types" },
      { label: "Respite Care", href: "/families#care-types" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Find Care", href: "/families#find-a-bed" },
      { label: "List Your Beds", href: "/providers#list-your-beds" },
    ],
  },
] as const;
