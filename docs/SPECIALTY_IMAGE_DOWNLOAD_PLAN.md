# Specialty Care — Image Download Plan

**Status:** The site currently reuses existing, already-curated senior-care photos in
`public/assets/images/` and `public/assets/new/` (real Pexels photography — nurse-with-senior,
caregiver-with-resident, family consultation, elderly hands/comfort). These are appropriate and
are wired into every section below.

**Why a plan instead of auto-download:** Outbound download from the Pexels CDN works, but
selecting *subject-accurate* photos requires the Pexels/Unsplash search UI (or an API key) to
verify each image actually shows the intended scene. Guessing photo IDs risks pulling random or
off-brief images — explicitly disallowed. So the specialty-specific images below should be
hand-picked by a person from the linked searches and dropped into
`public/assets/nonnis/specialty-care/` using the exact filenames listed (the code can then point
at them with a one-line swap).

Save all downloads (large / high-quality) into: `public/assets/nonnis/specialty-care/`

| Needed Image | Source Search URL | Suggested Filename | Section | Why It Fits |
|---|---|---|---|---|
| RN reviewing care needs with an older adult (tablet/checklist) | https://www.pexels.com/search/seniors%20with%20nurse/ | rn-memory-care-assessment.jpg | How It Works Step 02 · Match Console | Shows the RN care assessment — the core specialty step |
| Family discussing dementia care options with a guide | https://www.pexels.com/search/home%20care%20for%20dementia/ | dementia-care-family-guidance.jpg | Families page · Audience "For Bed Seekers" | Warm dementia/Alzheimer's placement guidance |
| Calm memory-care support moment with a senior | https://www.pexels.com/search/memory%20care/ | alzheimers-care-support.jpg | Gallery · Care types (Memory Care) | Alzheimer's / memory care, non-stigmatizing |
| Caregiver supporting an older adult (behavioral-health calm) | https://www.pexels.com/search/mental%20health%20care/ | behavioral-health-placement-support.jpg | Gallery · Providers page | Behavioral-health placement, warm not clinical |
| Caregiver helping a senior (walking / daily support) | https://www.pexels.com/search/elderly%20caregiver/ | caregiver-helping-senior.jpg | Live Availability cards · Audience | Provider/caregiver environment |
| Warm memory-care / community room (provider environment) | https://unsplash.com/s/photos/memory-care | provider-memory-care-room.jpg | Provider Dashboard (Cedar Grove) · Providers page | Provider room prepared for memory care |
| Family placement consultation (multigenerational) | https://unsplash.com/s/photos/family-caregiver | family-placement-consultation.jpg | Hero · Families page | Warm family/RN consultation feel |
| Older adult comfortable & safe in a care setting | https://www.pexels.com/search/senior%20living/ | senior-safe-environment.jpg | Resident Journey (04 settled in) | Safe, settled care environment |
| RN reviewing medication protocol (nurse + chart, not pills) | https://unsplash.com/s/photos/home-health-care | medication-protocol-review.jpg | RN Review checklist · Step 02 overlay | Medication protocol review, professional |
| RN with tablet doing a care review | https://unsplash.com/s/photos/nurse-and-patient | rn-tablet-care-review.jpg | Match Console avatar · Resident Journey (02) | RN/tablet care-review feeling |

## After dropping images in
Each filename above is referenced nowhere yet (safe to add). To use one, point the relevant
component/data field at `/assets/nonnis/specialty-care/<filename>` and add the matching alt text
from `docs/SPECIALTY_IMAGE_USAGE_REPORT.md`. No layout changes needed — slots already exist.

## Guardrails (from brief)
- No random living rooms, generic hospital hallways, sad/stigmatizing mental-health imagery,
  pills-as-hero, children/young-therapy, images with text, or AI-looking images.
- Prefer: nurse + older adult, caregiver + senior, family + elderly loved one, calm memory-care,
  provider/community rooms, RN with tablet/checklist, hands/comfort close-ups.
