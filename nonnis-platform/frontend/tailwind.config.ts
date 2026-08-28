import type { Config } from "tailwindcss";

/**
 * Operations design system, drawn from the public Nonnis website's "Warm
 * Premium Placement" brand (umber / bronze / antique gold on warm ivory) and
 * adapted for a calm, dense, trustworthy healthcare operations interface.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary accent — bronze (public site's CTA color).
        brand: {
          50: "#f7efe4",
          100: "#eddcc5",
          200: "#e2c8a3",
          500: "#c07f30",
          600: "#b56f28",
          700: "#9c5f22",
          800: "#82501d",
          900: "#5e4a38",
        },
        gold: "#d18f47",
        umber: "#472e16", // headings / dark structure
        ink: "#2b1b0e", // deepest text
        "slate-ink": "#5e4a38", // warm body text
        porcelain: "#faf7f2", // page background
        ivory: "#fffdf9", // card / surface
        sage: "#e7dccb", // warm border
        cream: "#f2e8db",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "#e7dccb",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(71 46 22 / 0.04), 0 8px 24px -16px rgb(71 46 22 / 0.16)",
        pop: "0 12px 40px -16px rgb(71 46 22 / 0.24)",
      },
    },
  },
  plugins: [],
};

export default config;
