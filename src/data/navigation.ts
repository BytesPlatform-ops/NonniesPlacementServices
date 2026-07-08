export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "For Families", href: "/families" },
  { label: "For Providers", href: "/providers" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const PRIMARY_CTA = { label: "Find a Bed", href: "/families#find-a-bed" };
export const SECONDARY_CTA = { label: "List Your Beds", href: "/providers#list-your-beds" };

export const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "AI-assisted matching", href: "/#ai-matching" },
      { label: "Browse communities", href: "/#browse" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Who we serve",
    links: [
      { label: "For Families", href: "/families" },
      { label: "For Providers", href: "/providers" },
      { label: "For Hospitals", href: "/pricing#hospitals" },
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
      { label: "Find a Bed", href: "/families#find-a-bed" },
      { label: "List Your Beds", href: "/providers#list-your-beds" },
    ],
  },
] as const;
