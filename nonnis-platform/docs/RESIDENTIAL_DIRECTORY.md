# Public Residential Provider Directory

A family-facing public directory of residential care communities on the marketing
website, sourced from the **existing internal `Provider` records**. There is **no
second provider database** and **no** matching/scoring/ranking, reviews/ratings,
billing, public capacity, family accounts, favorites, or public referral creation.

## 1. Source of truth & schema

The internal `Provider` remains canonical. One additive migration
(`20260902000000_provider_public_directory`) adds public-listing columns to
`providers`, all defaulting **OFF** so no existing provider is auto-published:

| Column | Purpose |
| --- | --- |
| `isResidentialProvider` (bool, default false) | Explicit residential classification. |
| `publicListingEnabled` (bool, default false) | Published to the directory. |
| `publicSlug` (text, **unique**) | Stable SEO URL slug (no UUIDs in public URLs). |
| `publicDescription` (text) | Public blurb; falls back to `description`. |
| `publicFeaturedImageUrl` / `publicFeaturedImageStoragePath` | Public image + managed storage path. |
| `publicSortOrder` (int) | Nonnis-defined display order. |
| `publicPublishedAt` (timestamp) | When first published. |

Indexes: unique `publicSlug`, plus `publicListingEnabled`. Canonical fields
(`displayName`, `description`, `phone`, `email`, `website`, `city`, `state`,
services, coverage, payment types, languages, hours) are the public source —
nothing is duplicated.

Prisma: `prisma format` + `validate` clean; migration applied with `migrate deploy`;
client regenerated. No `Provider`/`PublicProvider` duplicate model.

## 2. Publication model (Nonnis-only, explicit)

- Creating a Provider never publishes it. Publishing is an explicit Nonnis action.
- Access uses the existing **`providers.manage`** permission (Nonnis Admin +
  Operations). Provider-portal users (`providers.manage_own`) **cannot** publish,
  set residential status, or change the public listing — enforced by the backend
  guard, not just nav hiding.
- Admin endpoints (all `@RequirePermissions(providers.manage)`):
  - `PATCH /api/v1/providers/:id/public-listing` — residential flag, slug,
    description, image, sort order (slug uniqueness enforced → 409; replaced managed
    image cleaned up after the DB write).
  - `POST /api/v1/providers/:id/public-listing/publish` — validates then publishes.
  - `POST /api/v1/providers/:id/public-listing/unpublish`.
  - `POST /api/v1/providers/:id/public-listing/image-upload-url` +
    `DELETE …/image` — provider-scoped Supabase signed upload/delete.
- **Publish validation** (`public-listing.ts`, deterministic, unit-tested) requires:
  residential = true, status ACTIVE, a display name, a valid unique slug, a city and
  state, and ≥1 active service. Failure → `422` with a structured `missing[]` list the
  UI renders as a checklist; the Publish button stays disabled until ready.
- **Audit:** `provider.published` / `provider.unpublished` /
  `provider.public_listing_updated` `AuditEvent`s (actor, provider, safe metadata).
  Never a case `WorkflowEvent`.

## 3. Public API (unauthenticated, read-only)

`PublicProvidersController` (`@Controller("public/residential-providers")`, every
route `@Public()`):

- `GET /` — paginated cards. Filters: `q`, `state`, `city`, `serviceCategory`,
  `language`, `paymentType`; `sort` (`name` | `recent`, default = Nonnis
  `publicSortOrder` then name); `page`, `limit` (default 12, max 48). Server-side
  filtering only.
- `GET /options` — filter values that actually occur among published providers
  (service categories, languages, payment types, states).
- `GET /:slug` — full public detail, or `404`.

**Hard gate:** every query is constrained to
`{ status: ACTIVE, isResidentialProvider: true, publicListingEnabled: true }`.
Unpublished, non-residential, INACTIVE and PAUSED providers are unreachable.

**Explicit public serializer** (`public-provider.serializer.ts`): card = slug, name,
summary, city/state, image, services, languages; detail adds description, contact
(phone/email/website), public address (line 1 / city / state / postal), services,
coverage summary, payment types, languages, hours. It **never** includes internal
notes, eligibility notes, capacity, provider users/memberships, ids, organization
ids, status, storage paths, or audit data.

## 4. Public website

Routes (Next.js, warm "Nonni's" design system — `PageHero`, `Section`, `Card`,
`Badge`, `Reveal`, `FinalCTA`, warm tokens):

- `/residential-providers` — hero, search + filters (`DirectoryFilters`, URL-driven,
  desktop inline + **mobile filter drawer** with active chips + Clear), image-led
  `ProviderCard` grid, server-side pagination, a family-friendly empty state (never
  "0 rows"), and a cross-link to "List your community".
- `/residential-providers/[slug]` — image hero, About, Services, Service areas,
  Payment/Insurance, Languages, Hours (only sections with real data), and a contact/
  next-step aside (address, phone, email, website, "Talk to an RN", "Request more
  information"). Conservative `LocalBusiness` JSON-LD — **no fabricated
  ratings/reviews**.

Content is fetched **server-side** through the existing shared
`platform-api`/`content.ts` helpers (`getJson`, 30–60s revalidate, graceful
degradation) — no second API-URL helper. `next/image` serves Supabase images
(already allow-listed). The query-string builder is a pure, unit-tested helper
(`directory-query.ts`).

**Distinct from `/providers`:** the existing business-facing "For Providers" page and
the "List Your Community" form (one of the six website forms → email + PDF +
platform ingestion) are **untouched**. A `WebsiteFormSubmission` is never
auto-converted into a `Provider`.

### Navigation & SEO

- Header + footer gain a family-facing "Residential Care" / "Residential care
  directory" link (`data/navigation.ts`).
- Directory + detail pages set title/description/canonical/OpenGraph; unpublished
  detail returns `robots: noindex` and a 404.
- `sitemap.ts` includes only **published** provider slugs (the public API omits the
  rest), so unpublished/inactive/paused providers never appear.

## 5. Media

Reuses the CMS Supabase Storage architecture (`MediaService`, bucket
`nonnis-content`) with a new managed folder `providers/public/…` and a
provider-scoped signed-upload endpoint gated by `providers.manage`. The frontend
reuses the shared `MediaUpload` component (extended with optional
`uploader`/`deleter`) — no second uploader. Replaced/removed images clean up only
managed objects; external URLs are never deleted; the service-role key stays
backend-only.

## 6. Admin UI

A **Website Listing** tab in the provider workspace (Warm Premium design), visible
only with `providers.manage`. Shows Published / Ready to publish / Not published
status, a **View on website** link when published, a missing-information checklist
when incomplete, and the listing editor (residential toggle, slug + suggestion,
description, featured image, sort order). Publish/unpublish use the shared
confirm-dialog + toast + `MutationButton` flow (no `window.confirm`).

## 7. Demo data

`npm run seed:public-directory-demo` (idempotent; re-running replaces the set) seeds
~11 clearly-fictional demo communities tagged `organization.externalRef =
"PUBLIC_DIR_DEMO"` — 8 publicly visible plus deliberate exclusion cases
(unpublished, non-residential, paused) — reusing existing Supabase CMS images so
every public image returns HTTP 200. Remove with
`npm run seed:public-directory-demo -- --clean`.

## 8. Testing

- **Backend:** `public-listing.spec` (slug + publish validation), `public-providers.
  service.spec` (published gate, filters, pagination, slug 404, options aggregation),
  `public-provider.serializer.spec` (no internal-field leakage), and
  `providers-public-admin.spec` (publish validation → 422, unpublish, slug clash →
  409, image cleanup). Full suite: 271 tests.
- **Website:** `directory-query.test.ts` (query serialization). Full suite: 20 tests.
- Runtime verified end-to-end (Playwright + API): directory list/detail/filters/mobile
  drawer, exclusion of unpublished/non-residential/paused, image HTTP 200, sitemap
  inclusion/exclusion, and the admin publish → confirm → toast → unpublish flow.
