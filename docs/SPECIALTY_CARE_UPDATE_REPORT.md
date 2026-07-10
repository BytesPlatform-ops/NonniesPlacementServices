# Specialty Care Update — Report

Positioning update to surface Nonni's specialty placement capabilities: **Mental & Behavioral
Health, Dementia, Alzheimer's, Behavioral Health, Alzheimer's Care, Psychiatric Support, Memory
care, Tracking/wandering behaviors, Specialized medication protocols.**

Not a redesign — existing sections/cards/dashboards/copy updated in place. New reusable
`SpecialtyTag` chip drives consistent styling. Nonni's is positioned as a placement/matching
service (no diagnose/treat/cure/guarantee language).

## Change table

| Area | Change Made | Tags Added | Image Updated | Component/File | Screenshot |
|---|---|---|---|---|---|
| Specialty chip system | New reusable chip (default/gold/dark/outline) + hover glow | — | — | `components/ui/SpecialtyTag.tsx`, `globals.css` | (used throughout) |
| Hero specialty pills | Rotated in specialty positioning | Mental & Behavioral Health; Dementia & Alzheimer's; RN-reviewed specialty matching | reuse existing | `sections/Hero.tsx` | hero-specialty-tags.png |
| Live Availability cards | Specialty chips per provider | Behavioral Health, Dementia, Alzheimer's Care, Medication support, Mental & Behavioral Health, Psychiatric Support, Medication protocols | reuse existing | `data/listings.ts`, `marketplace/MarketplaceBedCard.tsx`, `marketplace/BedMarketplaceStrip.tsx` | live-availability-specialty-tags.png |
| How It Works — Step 02 | Retitled "RN clinical assessment" → "RN care assessment"; new description (cognitive/wandering/mental-health/medication protocols) | — | reuse existing | `data/howItWorks.ts`, `data/steps.ts` | step-02-rn-care-assessment.png |
| How It Works — Step 03 & AI pipeline | Softened headings per tone map | cognitive/behavioral copy | — | `data/howItWorks.ts`, `data/steps.ts` | step-02-rn-care-assessment.png |
| Match Console (home) | "Patient profile" → "Care profile"; Specialty needs chips; provider fit-reason tags; softened progress label | Alzheimer's support, Behavioral Health, Wandering risk, Medication protocol; per-provider: Alzheimer's Care/Behavioral Health/Psychiatric Support, Dementia/Medication support, Psychiatric Support/Specialized medication protocols | reuse existing | `data/matchConsole.ts`, `sections/AnimatedMatchConsole.tsx` | match-console-specialty-tags.png |
| Match Dashboard (pricing) | "Patient profile" → "Care profile"; specialty needs + provider reason tags | same as match console | reuse existing | `product/AIMatchDashboard.tsx` | match-console-specialty-tags.png |
| **Cedar Grove AFH Provider Portal** | Specialties (featured=gold), Specialty fit block, per-case inquiry badges | Behavioral Health, Alzheimer's Care, Psychiatric Support, Dementia, Memory Care, Medication Support; case badges: Alzheimer's/Wandering risk/Behavioral Health, Dementia/Medication support, Psychiatric Support/Specialized meds | reuse existing | `product/ProviderPortalPreview.tsx` | cedar-grove-provider-dashboard-tags.png |
| Provider Availability Board | Specialty chips per facility | Behavioral Health, Alzheimer's Care, Psychiatric Support, Dementia, Medication support/protocols | reuse existing | `product/ProviderAvailabilityBoard.tsx` | providers-page-specialty-tags.png |
| RN Review checklist | Specialty review items | Memory care needs; Wandering/tracking behaviors; Mental health history; Medication protocols; Specialty provider fit | — | `product/RNReviewChecklist.tsx` | providers-page-specialty-tags.png |
| For Bed Seekers | Specialty placement bullets | Dementia/Alzheimer's guidance; Mental & behavioral health support; RN review for meds/wandering/safety/memory | reuse existing | `sections/AudiencePreview.tsx` | families-page-specialty-copy.png |
| For Bed Providers | Provider capability chips | Behavioral Health, Alzheimer's Care, Psychiatric Support, Dementia, Memory Care, Medication Support | reuse existing | `sections/AudiencePreview.tsx` | providers-page-specialty-tags.png |
| Matching signals | Specialty signals | Mental & Behavioral Health, Dementia, Alzheimer's, Wandering/tracking behaviors, Psychiatric Support, Medication protocols, Memory care needs, Available support | — | `data/steps.ts` (AI_SIGNALS) | — |
| Floating match cards (home) | "Clinical fit" → "A safer, more supportive fit" | behavioral support/medication protocol | — | `sections/FloatingMatchCards.tsx` | — |
| Gallery / In Their World | Specialty captions | RN-reviewed specialty care; Memory care, matched safely; Behavioral health placement; Dementia and Alzheimer's support; Support beyond move-in | reuse existing | `sections/CareStoryCarousel.tsx`, `data/placementGallery.ts` | gallery-specialty-images.png |
| Pricing feature lists | Specialty features + softened label | Specialty care matching; Dementia & Alzheimer's support; Mental & behavioral health review; Medication protocol review | — | `data/pricing.ts` | — |
| Resident Journey | Enriched RN-assessment + match copy (memory/wandering/behavioral) | — | reuse existing | `data/journey.ts` | — |
| Intake Timeline | Softened "Provider matching" → "Finding the fit" | — | — | `product/IntakeTimeline.tsx` | — |

## Heading softening map (applied)
| Old | New |
|---|---|
| Intelligent matching | Matching Your Loved One's Unique Story |
| Clinical fit | A safer, more supportive fit |
| Fit & eligibility filtering | Finding Options That Can Truly Help |
| Structured signals in | Understanding the Whole Situation |
| Scoring | Finding the Strongest Options |
| Human layer | A Nurse Reviews the Final Fit |
| Provider matching | Finding the fit (micro-label, layout-safe) |
| RN clinical assessment | RN care assessment |
| Patient profile | Care profile |
| Behavioral concerns | Behavioral support needs |
| Provider capacity | Available support |

## Visual tag design
`SpecialtyTag` — rounded-full, ivory bg / bronze border / umber text; **gold** variant (Antique
Gold) for featured/active; **dark** variant for dark dashboards; hover lifts + Antique-Gold glow.

## Responsive / accessibility
- Chips use `flex-wrap` everywhere → wrap cleanly on mobile; dashboards don't overflow (verified
  mobile match console).
- Alt text kept meaningful (see image usage report). Tags are text (not color-only).

## Screenshots (`docs/audit-screenshots/specialty-update/`)
- hero-specialty-tags.png
- step-02-rn-care-assessment.png
- match-console-specialty-tags.png
- cedar-grove-provider-dashboard-tags.png
- live-availability-specialty-tags.png
- families-page-specialty-copy.png
- providers-page-specialty-tags.png
- gallery-specialty-images.png
- mobile-specialty-tags.png

## Images
Existing curated senior-care photography reused (already appropriate). New specialty-specific
photos to be hand-picked from Pexels/Unsplash searches — see `SPECIALTY_IMAGE_DOWNLOAD_PLAN.md`
and `SPECIALTY_IMAGE_USAGE_REPORT.md`. Folder ready: `public/assets/nonnis/specialty-care/`.

## Build / lint
- `npm run build` → success (all routes prerendered)
- `npm run lint` → clean (0 warnings/errors)
