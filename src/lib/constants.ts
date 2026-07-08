/** Brand + contact constants. Placeholder contact details — frontend only. */

export const BRAND = {
  name: "Nonni's Placement Services",
  shortName: "Nonni's",
  tagline: "Right Care. Right Placement. Right Time.",
  region: "Washington State",
} as const;

export const CONTACT = {
  phonePrimary: "(206) 531-8890",
  phoneSecondary: "(206) 650-4985",
  phonePrimaryHref: "+12065318890",
  phoneSecondaryHref: "+12066504985",
  email: "info@nonnisplacementservices.com",
  address: "1521 137th St E, Tacoma, WA 98445",
  region: "Serving all of Washington State",
  hours: "Mon–Fri 8am–6pm PT · On-call support for active placements",
  website: "nonnisplacementservices.com",
} as const;

/** Brand color tokens mirrored for use in JS (WebGL shaders, GSAP, charts). */
export const COLORS = {
  navy: "#472e16",   // deep umber
  blue: "#b56f28",   // bronze
  teal: "#b56f28",   // bronze
  coral: "#b56f28",  // bronze (primary CTA)
  gold: "#d18f47",   // antique gold
  ice: "#f2e8db",    // soft cream
  midnight: "#2b1b0e", // deep ink
  mint: "#d18f47",   // antique gold glow
  aqua: "#e2b483",   // light gold
} as const;
