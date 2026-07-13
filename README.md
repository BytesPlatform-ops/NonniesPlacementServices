# Nonni's Placement Services — Frontend.

A premium, animation-rich marketing frontend for **Nonni's Placement Services**, an RN-led care-placement platform for Washington State. Built to hold two registers at once: **warm trust** where families make care decisions, and **modern AI-health-tech sophistication** where the platform shows off its matching engine.

> **Frontend only.** There is no backend, database, auth, or real integrations. Forms validate and show success states **locally** — nothing is sent, stored, or transmitted. Numbers, listings, and testimonials are illustrative.

Built against the two source-of-truth briefs in [`/docs`](./docs): `Nonnis_Design_Research.md` (creative spec) and `Nonnis_References_Tutorials_Libraries.md` (implementation reference).

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `src/`, TypeScript strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens) |
| Animation | GSAP + ScrollTrigger + DrawSVG, Lenis smooth scroll, `@gsap/react` |
| WebGL hero | React Three Fiber + drei (`PerformanceMonitor`), custom GLSL shader |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Icons | lucide-react |
| Fonts | Fraunces (display) + Inter (body), via `next/font` |

## Design system

- **Palette** — Direction A "Clinical Trust" system-wide (`navy #0C447C`, `blue #185FA5`, `teal #1D9E75`, coral CTA `#D85A30`, `ice #E6F1FB`) + Direction C "Modern Health-Tech" (`midnight #0D1B2A`, `mint #02C39A`, `aqua #80FFEA`) for the hero and AI/platform sections. Tokens live in `src/app/globals.css` (`@theme`) and mirrored for JS in `src/lib/constants.ts`.
- **Type** — Fraunces for expressive display headings; Inter for legible body (≥16px, generous line-height — a hard requirement for the senior-care audience).

## Routes

| Route | Purpose |
|---|---|
| `/` | Home — hero, problem, solution, pinned How-it-works, differentiators, audience previews, browse catalogue, pinned AI-matching, pricing, trust, about preview, final CTA |
| `/families` | Family-focused hero, how we help, care types, **Find a Bed** form, FAQs |
| `/providers` | Provider hero, why-list benefits, stats, **List Your Beds** form, FAQs |
| `/pricing` | Segmented pricing toggle (Families / Hospitals / Communities) with hash deep-linking, FAQs |
| `/about` | Mission, values, care-marketplace explanation, impact stats |
| `/contact` | Contact cards, quick actions, map placeholder, inquiry form |
| `not-found` | Branded 404 |

## Animation systems

- **Smooth scroll** — Lenis synced to the GSAP ticker (one rAF loop); reduced-motion users get native scroll.
- **Branded preloader** (`components/layout/Preloader.tsx`) — SVG logo stroke-draw, real 0→100 asset-tied progress (fonts + window load), curtain wipe that morphs into the hero. Shows once per session (`sessionStorage`), skipped for reduced motion. Hides itself rather than unmounting, so React never removes GSAP-mutated DOM.
- **WebGL hero** (`components/webgl/`) — "Living Gradient Mesh": a fullscreen shader quad (simplex-noise navy→teal→mint, breathing + cursor-reactive). Lazy-loaded via `dynamic(..., { ssr: false })`, adaptive DPR via drei `PerformanceMonitor`, error boundary → static poster. **Not** rendered on mobile or under reduced motion.
- **Pinned scrollytelling** — "How it works" (5-step) and "AI matching" (dark) use ScrollTrigger `pin + scrub + snap`, with stacked-card fallbacks on mobile/reduced-motion.
- **Reveal / Parallax / Counters** — reusable scroll-triggered rise-and-fade, transform-only parallax, and count-ups in `components/animation/`.
- **Micro-interactions** — magnetic CTAs (`gsap.quickTo`, pointer-fine only), sticky nav shrink, slide-in mobile menu, animated segmented control, focus states.

## Reusable components

- **UI** (`components/ui/`) — `Button`, `Card`, `GlassCard`, `Badge`, `Container`, `Section`, `SectionHeading`, `SegmentedControl`, `PricingCard`, `StepIndicator`, `FormField`, `Select`, `Textarea`, `Checkbox`, `StatCard`, `FeatureCard`, `Accordion`.
- **Animation** (`components/animation/`) — `SmoothScrollProvider`, `ScrollProgressBar`, `Reveal`, `Parallax`, `MagneticButton`, `AnimatedCounter`, `ClipRevealImage`.
- **Forms** (`components/forms/`) — multi-step `FindBedForm`, `ListBedsForm`, single-step `ContactForm`, `PhotoUploadPlaceholder`, `FormSuccess`.

## Accessibility

Semantic HTML, real buttons/links, visible focus rings, skip-to-content link, labelled form fields with errors linked via `aria-describedby`, accessible mobile menu (Esc + scroll lock), no text baked into canvas, and full `prefers-reduced-motion` support (no smooth scroll, no preloader, no WebGL, instant reveals). Media-query state uses `useSyncExternalStore` for SSR-safe, deterministic first paint.

## Performance

Animates `transform`/`opacity` only; Three.js is lazy-loaded and never blocks first paint; WebGL is skipped on small screens; canvas uses `antialias:false, depth:false, stencil:false, alpha:false` with adaptive DPR; glassmorphism is limited to nav, hero, and pricing cards.

## Getting started

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
```

Requires Node 18.18+ (developed on Node 26). If a port is busy: `PORT=3001 npm run dev`.

## Known limitations

- **Frontend only** — no backend, auth, payments, uploads, email, or SMS. Forms show local success states; the photo uploader is a non-functional placeholder.
- **Illustrative content** — stats, community listings, testimonials, and contact details are placeholders.
- **WebGL** is a progressive enhancement; mobile and reduced-motion users get an animated CSS-gradient poster.
- **Logo** — the provided circular brand asset (`public/brand_assets/logo.png`) is used as-is; the preloader mark is a tasteful line-art SVG derived from the brand's sheltering-home shape.

## Project structure

```
src/
  app/            # routes + globals.css + layout + not-found
  components/
    animation/    # scroll + motion primitives
    forms/        # multi-step forms
    layout/       # navbar, footer, mobile menu, preloader, logo
    sections/     # page sections (hero, scrollytelling, pricing, …)
    ui/           # design-system primitives
    webgl/        # R3F canvas, shader, poster fallback
  data/           # navigation, pricing, features, care types, steps, faqs
  hooks/          # reduced-motion, mobile, media-query, isomorphic layout effect
  lib/            # utils, gsap registry, constants, ready coordinator
docs/             # source-of-truth research briefs
public/brand_assets/  # logo
```
