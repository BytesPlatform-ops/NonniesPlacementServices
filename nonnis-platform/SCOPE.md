# Nonnis Platform — Scope (Source of Truth)

This document is the **local source of truth** for what the Nonnis Digital
Optimization Platform does and does not include. Read it before implementing any
new feature. If a request appears to require an excluded module, stop and confirm
scope before building.

---

## 1. Core platform objective

An internal operations platform for coordinating **post-discharge care**. The
central object is the **discharge case**, moving through a mostly-manual lifecycle:

```
intake → requirements → manual provider search/selection → referral →
provider response → coordination → discharge → service start → follow-up → completion
```

It serves three user groups over time — **Discharge Professionals**, **Service
Providers**, and **Nonnis Operations Staff**. Provider selection is always manual
(search + filter + human choice). There is **no** matching, scoring, or automation
engine between a service request and provider selection.

---

## 2. Current included modules (standard operational/admin scope)

- Users
- Roles & permissions (RBAC)
- Organizations
- Facilities
- Providers, provider profiles, provider services
- Provider availability / capacity (basic operational level)
- Service categories
- Discharge cases & case intake
- Requirements
- Service requests
- Case assignment
- Manual operational workflows
- Referrals & provider responses (accept / conditional accept / request info / decline)
- Tasks
- Basic case communication (notes / messages / referral Q&A)
- Basic operational dashboards
- Basic reporting (counts, grouped summaries, simple filters, admin reports/exports)
- General platform administration
- Public website content management (blog articles, short videos, testimonials)
- Public residential provider listings/directory

---

## 3. Explicitly excluded advanced modules (DO NOT BUILD)

These are separate advanced systems and are **out of scope**. Do not implement them,
and do not let an in-scope feature evolve into them.

1. **External API & Integration Architecture** — EHR / hospital / provider-management
   / insurance integrations, FHIR interoperability, external reconciliation,
   data-mapping engines, integration retry/error-queue engines, integration
   monitoring dashboards, source-of-truth reconciliation, external-system sync.
   - *Distinction:* the app's **own** internal NestJS `/api/v1` REST API is required
     and must not be weakened. This exclusion is only the dedicated external
     integration platform.
2. **Workflow Automation Engine** — configurable event-condition-action rules,
   rule builders, automated deadline/escalation workflows, automatic reminders,
   automated discharge-risk actions, credential-expiration automations, background
   automation orchestration.
   - *Distinction:* KEEP manual workflows — case status transitions, `WorkflowEvent`
     history, manual assignment, manual requirement updates, deterministic case
     attention indicators, validation, and manually initiated actions.
3. **Provider Matching Engine** — hard eligibility-filtering engines, weighted
   provider scoring, ranking, exclusion engines, recommendation scoring, match
   percentages, configurable weights, explainable recommendations, ML matching,
   automated provider selection.
   - *Distinction:* simple provider search/filter/inspect + manual selection is
     normal CRUD and IS in scope. It must never become scoring/ranking.
4. **Advanced Analytics & Reporting** — analytics event pipelines, advanced
   scorecards, trend-analysis engines, complex performance comparisons, cohort
   analysis, referral-leakage analytics, predictive metrics, BI dashboards,
   analytics warehouse architecture.
   - *Distinction:* basic reporting (total/open/completed cases, cases by
     status/facility, providers, referrals, simple response counts, date-range
     filters, exportable admin reports) and existing dashboard metrics / attention
     summaries remain in scope.
5. **Document & Compliance Management System** — dedicated document management,
   versioning, approval workflows, credential management/verification, credential
   expiration tracking, compliance dashboards, document expiration monitoring,
   e-signature workflows, virus-scanning pipelines, restricted-document-access
   engines, compliance rules engines.
   - *Distinction:* simple informational provider-profile fields (license number,
     certification text, basic descriptive credentials) may be stored as ordinary
     metadata IF genuinely needed — never as tracking/approval/verification systems.

---

## 4. Important scope distinctions

- **`WorkflowEvent` is business history**, not the excluded automation engine. It
  powers the case activity timeline, status/assignment history, accountability, and
  basic operational auditing. Keep it.
- **`AuditEvent` is core platform security** — administrative & security-sensitive
  action history (role/user/org/facility administration). Not the excluded Document
  & Compliance module. Keep it.
- **`ServiceRequest` descriptive fields** (service category, care level, geography,
  required qualifications, language, funding/insurance needs, requested date,
  equipment, transportation) remain — they describe the requested service and support
  **manual** provider search/selection. They must not power scoring/ranking.
- **Case attention logic** (overdue discharge, missing information, incomplete /
  blocked requirement, no assigned professional, inconsistent dates) is deterministic
  operational UI. It is not automation or advanced analytics.
- **Case status values** such as `MATCHING` / `REFERRAL_SENT` / `PROVIDER_REVIEWING`
  denote stages of the **manual** referral workflow (a person selecting a provider
  and sending a referral). They are lifecycle labels, not an automated matching step.
- **Basic transactional notifications** tied to an explicit user action (e.g. sending
  a referral emails the provider) are allowed as a normal product action later. They
  must not become configurable automated reminder/escalation workflows. (Not built in
  this realignment slice — architecture compatibility is preserved only.)
- **Public website forms — future additive persistence (agreed).** Today the
  existing public Nonnis website forms are used only as a UI reference (styling /
  field structure / validation) and their submissions go to email. A future slice
  will ALSO persist the same submissions into the platform so admin staff can view
  them internally. This is **additive**: the existing email delivery and any
  current document/report output MUST continue to work unchanged; platform
  persistence is added alongside them. The forms are **not** wired into the
  platform yet — do not connect them until that slice.

---

## 5. Current completed implementation

- **Slice 1 — Platform Foundation:** modular NestJS backend + Next.js frontend,
  internal `/api/v1` REST API, Prisma + Supabase Postgres, core domain schema,
  health, case list/detail, design system.
- **Slice 2 — Identity / Auth / Authorization / Organizations / RBAC:** Supabase
  Auth (server-side token verification), global AuthGuard + PermissionsGuard, roles &
  permissions, organizations, users & invitations, facilities, organization data
  isolation, role-escalation protection, audit events, admin UIs, org switcher.
- **Slice 3 — Discharge Professional Dashboard & Case Workspace:** dashboard
  aggregates, case list with server-side filters, case create/edit, structured needs
  assessment, requirements & service requests, case assignment, deterministic
  attention/completeness model, safe manual status transitions with structured
  blockers, workflow timeline, brand-aligned UI.
- **Slice 4 — Scope Realignment & Architecture Cleanup:** documented the agreed
  scope and the five excluded advanced modules; no functional regressions.
- **Slice 5 — Provider Management + Service Categories + Capacity:** provider
  directory (profiles, services, geographic coverage, accepted payment/insurance
  types, languages, operating hours, eligibility, capacity/availability, status),
  admin-managed ServiceCategory/PaymentType/Language catalogs, provider search &
  filtering, strict provider-organization isolation, and provider RBAC — all manual
  CRUD, no matching/scoring/compliance. Provider users reuse the existing
  User + OrganizationMembership identity model.
- **Slice 6 — Basic Provider Portal:** a self-service portal (`/provider/*`) where
  Provider Admin / Provider Staff maintain their OWN provider's profile, services,
  coverage, payment types, languages, hours, capacity, and team. Provider identity
  is derived server-side from the active organization (`GET /provider-portal/me`);
  mutations reuse the Slice 5 provider APIs under ProviderAccessService isolation.
  Role-aware landing sends provider users to the portal. Internal notes and provider
  status are Nonnis-only (never readable/writable by provider users). No referrals,
  matching, automation, compliance, or analytics.
- **Slice 7 — Nonnis Admin Operations Control Center:** a Nonnis-only, cross-org
  operational surface (`/operations`) gated by `cases.read_all`. Platform-wide
  operational summary counts, a cross-organization case queue (search + status +
  overdue/attention/unassigned/blocked/incomplete filters, reusing the shared
  deterministic attention model), a provider operational overview (status /
  availability / no-services / no-coverage filters), and recent workflow activity.
  Manual quick actions (reassign, block/unblock) reuse the existing case endpoints
  (which already honour `cases.read_all`) — no new mutation logic and no weakening of
  tenant isolation elsewhere. No referral/matching/automation/analytics/compliance.
- **Slice 8 — Website Form Submissions -> Admin Panel:** the public website's six
  forms (single `/api/forms/submit` handler) now **additionally** persist each
  submission to the platform after the existing email/PDF flow, via a server-to-server
  token-guarded ingest (`POST /api/v1/form-submissions/ingest`, idempotent on the
  website reference). Nonnis staff review them at `/operations/form-submissions`
  (`form_submissions.read/manage`) with a manual NEW/IN_REVIEW/RESOLVED/ARCHIVED
  workflow and notes. File bytes and secrets are never stored; email/PDF behavior is
  unchanged. See `docs/WEBSITE_FORM_INGESTION.md`.
- **Slice 9 — Referral Workflow + Manual Provider Selection:** from a case service
  request, staff **manually** search/filter the provider directory and select a
  provider (no matching/scoring), creating a `Referral` (DRAFT→SENT→VIEWED→…) with a
  basic transactional email notification (recipient = active provider admins, else
  the provider email; failure recorded as FAILED, manual resend, referral preserved).
  Providers review referrals in their portal (`/provider/referrals`) and respond:
  Accept (creates a `Placement`), Conditionally Accept (kept distinct), Request
  Information, or Decline (structured reason). Staff can provide clarification and
  withdraw. Placements carry a distinct service-start lifecycle
  (ACCEPTED→SCHEDULED→STARTED / UNSUCCESSFUL) — referral acceptance, service
  scheduling, patient discharge, and actual service start are kept separate. Case
  status advances conservatively via a centralized policy (MATCHING/REFERRAL_SENT/
  PROVIDER_REVIEWING/ADDITIONAL_INFORMATION_REQUIRED; ACCEPTED only when *every*
  service request has an accepted placement). All referral/placement events flow into
  the existing case timeline. Operations gains a cross-org referral queue. No
  automation, escalation, matching, or document system.
- **Slice 10 — Tasks + Basic Case Messaging + Unified Timeline:** three distinct
  concepts. **Tasks** (`Task`, OPEN/IN_PROGRESS/COMPLETED/CANCELLED, LOW/NORMAL/HIGH/
  URGENT; overdue is derived, never stored) are manually created/assigned per case
  (`tasks.read/manage/read_all`) — no automation/reminders/escalation. **Messages**
  (`Message`, append-only) carry one of three visibility scopes: CASE_TEAM (case org
  + Nonnis), NONNIS_INTERNAL (Nonnis staff only), PROVIDER_REFERRAL (one referral's
  provider + the case/Nonnis side — providers never see another's thread), decided by
  a centralized MessageAccessService. The formal referral clarification workflow
  (ReferralResponse) is unchanged; referral messages are for ordinary follow-up.
  A **unified `GET /cases/:id/timeline`** merges WorkflowEvents with the messages the
  viewer may see (internal notes only for `internal_notes.manage`; providers cannot
  reach it) — one history, no duplicates. UI: case workspace Tasks + Communication +
  unified Activity tabs, a My Tasks page, a discharge-dashboard task widget, and an
  Operations task queue. No attachments, analytics, or automation.
- **Slice 11 — Discharge Readiness Score + Operational Blockers:** a deterministic,
  explainable readiness evaluation computed **live** from source-of-truth records
  (case info, requirements, service requests, accepted placements) — never a persisted
  column, no schema change. The pure `readiness-domain` returns transparent
  **components** (COMPLETE / INCOMPLETE / BLOCKED / NOT_APPLICABLE), a **percentage**
  over applicable components, **mandatory gates**, and normalized **blockers**
  (INFO / WARNING / CRITICAL). Two concepts are kept distinct: percentage never decides
  readiness — `ready` is true only when **every** mandatory gate passes (manual block,
  case information, assignment, service-request completeness, no blocked/incomplete
  required requirement, accepted provider placement for every active service request,
  scheduled service start, consistent dates). Placement reuses the referral slice's
  `allServiceRequestsPlaced` rule; a conditional acceptance or cancelled/unsuccessful
  placement never satisfies it. It is separate from — and shares helpers with — the
  existing Case Attention model. `GET /cases/:id/readiness` (cases.read; providers
  excluded). Explicit **manual** lifecycle actions harden the case lifecycle:
  `mark-ready-for-discharge` (gates must pass), `mark-discharged` (requires
  READY_FOR_DISCHARGE + an explicit actual discharge date), `mark-service-started`
  (discharged + every required placement STARTED), and `mark-completed` (deterministic
  completion eligibility). Readiness NEVER self-transitions status; regression is shown
  (`statusMismatch`) but never auto-bounced. UI: a workspace **Readiness** tab (dial,
  gates, component checklist, blockers with links, actions), a header readiness badge,
  a discharge-dashboard readiness widget, and Operations readiness counts + queue
  filters. No AI, prediction, scoring engine, matching, analytics, or automation.
- **Client insertion — Public Website Blog + Short Videos + Testimonials CMS:** a
  focused `content` module manages three record types — **BlogPost** (Markdown-subset
  body, unique SEO slug, DRAFT/PUBLISHED/ARCHIVED), **ShortVideo** (curated video
  metadata, active/order, optional post association), and **Testimonial** (quote +
  optional attribution, active/featured/order, Nonnis-only `internalNotes`). New
  `content.read`/`content.manage` permissions (Nonnis Admin + Operations only;
  providers/discharge pros excluded). **Public read-only** `@Public()` endpoints
  (`/public/blog`, `/public/blog/:slug`, `/public/blog-videos`, `/public/testimonials`)
  expose ONLY published/active, public-safe fields — no drafts, no internal notes, no
  user metadata; list responses omit article bodies. **Admin CRUD** endpoints
  (`/blog-posts`, `/short-videos`, `/testimonials`) are permission-gated and audited.
  The public website gained a `/blog` index, `/blog/[slug]` detail (safe Markdown
  renderer, `generateMetadata`, sitemap/robots), a premium horizontal short-video strip
  with a single-video lightbox, and a flowing homepage testimonials marquee — all in the
  existing Warm Premium design language, fetched server-side via `NONNIS_PLATFORM_API_URL`
  with graceful degradation. The CRM gained a **Content** nav group (Blog / Short Videos
  / Testimonials). Additive only — no page-builder, transcoding, analytics, AI, or
  scheduled publishing; the six public forms + email/PDF/ingestion are untouched.
  - **Repair pass:** fixed the public site showing nothing (missing
    `NONNIS_PLATFORM_API_URL` → added a shared `platform-api` helper with a
    dev-only localhost fallback, visible dev diagnostics, and 30s revalidation)
    and the fragile root-relative media (→ **Supabase Storage** bucket
    `nonnis-content` with backend-minted signed direct uploads, storage-path
    columns for safe replace/delete, an idempotent `content:seed-media` migration
    of the demo media, and `images.remotePatterns` for both apps). Added a proper
    **rich Markdown editor** (toolbar, H1–H6, keyboard shortcuts, Write/Split/Preview)
    and CRM media upload UI, an upgraded immersive short-video rail, a website
    runtime smoke test, and media/editor/connectivity tests. Still no transcoding,
    streaming, analytics, AI, or scheduled publishing. See
    `docs/WEBSITE_CONTENT_CMS.md`.
  - **UX hardening pass:** the public short-video rail became a full-bleed, muted
    auto-playing + auto-scrolling media wall (IntersectionObserver-gated playback,
    pause on hover/drag/lightbox/hidden-tab/reduced-motion, seamless loop). And a
    platform-wide **action UX system** was added — one reusable
    confirm-dialog + toast + pending-button flow (`ConfirmProvider`/`useConfirm`,
    `ToastProvider`/`useToast`, `MutationButton`/`useAction`) replacing every
    `window.confirm` and silent mutation across content, users, orgs, facilities,
    catalogs, cases, tasks, referrals, providers, provider-portal, operations, and
    form submissions. Frontend-only; no backend/schema change.
- **Slice 12 — Basic Reporting + Administrative Reports:** a Nonnis-only `reports`
  module answering straightforward administrative questions over **current**
  PostgreSQL data — no analytics warehouse, trends, comparisons, scoring, ranking,
  prediction, scheduling, or report builder. New `reports.read`/`reports.export`
  permissions (Nonnis Admin + Operations only; providers/discharge pros excluded,
  enforced by the backend guard, not nav hiding). Reporting queries are
  intentionally cross-organization and live inside `ReportsService`/dataset
  services — ordinary tenant-scoped APIs are unchanged. Reports: an **overview**
  hub (`GET /reports/overview`, counts only) plus **Case**, **Referral**,
  **Provider directory**, **Readiness snapshot**, **Task**, and **Website form
  submission** reports, each returning a typed `{ appliedFilters, summary, groups,
  items, page… }` envelope with server-side date/organization/facility filtering,
  search, whitelisted sort, and pagination. Business definitions are **reused, not
  duplicated** — active-case statuses (`case-query`), the deterministic readiness
  domain + `readiness-query` WHERE fragments (readiness is computed live per
  displayed row via `computeReadiness`, bounded to the page — no N+1), a shared
  `referralOverdueWhere`, and existing enums. **CSV export** (`reports.export`) for
  every dataset reuses the on-screen filters, sanitizes against spreadsheet
  formula-injection (`sanitizeCsvCell`), caps at 10,000 rows (422 otherwise),
  streams UTF-8 with a dated filename, and writes a lightweight `report.exported`
  audit event (actor + type + safe filters + row count — never the rows).
  Minimum-necessary data only: no clinical notes, internal notes, message bodies,
  or `submittedData`. The CRM gains a **Reports** nav group and `/reports` +
  `/reports/{cases,referrals,providers,readiness,tasks,form-submissions}` pages in
  the Warm Premium design language — compact filter bar, active-filter chips,
  reset, URL/query filter state, summary metric cards (counts only), grouped-count
  tables, responsive scrolling tables with server-side pagination, loading/empty/
  error states, toast-driven CSV export, and print-friendly output (chrome/filters
  hidden, title + generated timestamp + applied period/scope preserved). See
  `docs/REPORTING.md`.
- **Slice 13 — Public Residential Provider Directory:** the existing internal
  **Provider** records became publicly discoverable on the marketing website — no
  duplicate provider database. Minimal additive Provider fields
  (`isResidentialProvider`, `publicListingEnabled`, `publicSlug` (unique),
  `publicDescription`, `publicFeaturedImageUrl`/`publicFeaturedImageStoragePath`,
  `publicSortOrder`, `publicPublishedAt`), all defaulting **OFF** so nothing is
  auto-published; canonical Provider fields remain the public source. Publishing is
  an explicit **Nonnis-only** action (`providers.manage`; provider users cannot
  self-publish) with deterministic **publish validation** (residential + ACTIVE +
  display name + valid unique slug + city/state + ≥1 active service) returning
  structured missing fields, and `provider.published`/`unpublished`/
  `public_listing_updated` **AuditEvents**. Public read-only `@Public()` API
  (`/public/residential-providers`, `/:slug`, `/options`) is hard-gated to
  ACTIVE + residential + published and returns an **explicit public serializer**
  (no internal notes, capacity, users, ids, or storage paths). The public website
  gained a family-facing **`/residential-providers`** directory (distinct from the
  business-facing `/providers`, which is untouched) — image-led cards, server-side
  search/filter/sort, pagination, a mobile filter drawer, a detail page with
  conservative `LocalBusiness` structured data, SEO metadata, and sitemap entries
  for published providers only. Provider images reuse the existing Supabase
  Storage signed-upload architecture (`providers/public/…`) via a provider-scoped
  endpoint and the shared `MediaUpload`. A **Website Listing** admin tab (Warm
  Premium design; confirm/toast/`MutationButton`) manages it. An idempotent
  `npm run seed:public-directory-demo` seeds clearly-fictional demo communities.
  No matching/scoring/ranking, reviews/ratings, billing, public capacity, family
  accounts, favorites, or public referral creation. See
  `docs/RESIDENTIAL_DIRECTORY.md`.
- **Slice 15A — Communications Foundation (Contacts + Imports + Consent/Suppression):**
  the first phase of a new **Communications** module — a dedicated
  marketing/outreach contact database, intentionally **separate** from
  User/Patient/Provider identities and never linked to Case/Patient records (PHI
  boundary). New `communications.read` / `.manage` / `.import` permissions (Nonnis
  Admin + Operations only). Additive models: `CommunicationContact` (email/phone
  with normalized + E.164 forms, MANUAL/PASTE/CSV/TXT source, ACTIVE/ARCHIVED),
  channel-specific `ContactChannelPreference` (consent UNKNOWN/OPTED_IN/OPTED_OUT —
  imports default to **UNKNOWN**, never auto opted-in), `CommunicationList` +
  members, `CommunicationTag` + assignments, `CommunicationSuppression`
  (upsert/reactivate, authoritative for future sending), `CommunicationImportBatch`
  (summary counts only — never raw contact lists), and a minimal future-safe
  `CommunicationConversation`/`CommunicationMessage` foundation (no UI, no sending).
  Reputable normalization (`libphonenumber-js` E.164 with an explicit default
  country; class-validator email **format** validation — not mailbox verification).
  Deterministic duplicate/conflict classification that **never auto-merges** two
  distinct people (email→A + phone→B = CONFLICT). A polished **import wizard**
  (paste / CSV with column mapping / TXT) — parse → validate → preview → confirm →
  commit, where preview never mutates and commit **re-validates server-side**;
  bounded to 5 MB / 25,000 rows; raw files are never stored; a downloadable
  formula-injection-safe error CSV. A **provider-independent transport
  architecture** — `EmailTransport` / `SmsTransport` ports injected by DI token,
  with deterministic **mock** implementations selected by config (default mock; live
  Brevo/Twilio fail safely as not-yet-implemented). CRM UI: a **Communications** nav
  group (Contacts / Lists / Imports) in the Warm Premium design language. A reusable
  `evaluateChannelEligibility` policy (for 15B/15D). **No** real Brevo/Twilio calls,
  bulk send, campaign/template builder, inbox, inbound webhooks, schedulers, or
  analytics. See `docs/COMMUNICATIONS.md`.

- **Slice 15B — Email Templates + Visual Email Builder + Email Campaigns:** the
  outbound-email phase of the Communications module. New `communications.send`
  permission gates all campaign queueing and test sends. Additive models:
  `CommunicationEmailTemplate` (versioned block **design JSON** + server-compiled
  HTML/text; DRAFT/ACTIVE/ARCHIVED), `CommunicationEmailCampaign` (immutable content
  **snapshot** + audience config, DRAFT→READY→QUEUED→SENDING→COMPLETED/
  PARTIALLY_FAILED/CANCELLED), `CommunicationEmailCampaignRecipient` (per-recipient
  contact/email snapshot, delivery status, attempt/lease bookkeeping, opaque
  `unsubscribeToken`/`threadToken`), and `CommunicationEmailEvent` (idempotent,
  deduped provider delivery events). A **visual email builder** (text/heading/image/
  button/columns/divider/spacer blocks) whose HTML the **backend MJML compiler is
  authoritative over** — the frontend never supplies trusted HTML; a merge-field
  **allow-list** (firstName/lastName/fullName/email/organizationName + system
  `unsubscribeUrl`) that **excludes all patient/case/clinical/PHI fields**. Campaign
  recipient building enforces the 15A `evaluateChannelEligibility` policy +
  suppression at **both** queue time and a **second check at send time** (never send
  if newly ineligible). A **Postgres-backed delivery queue** (`FOR UPDATE SKIP
  LOCKED`, bounded concurrency, retry with backoff) so the HTTP request that queues a
  campaign never sends the emails itself; ambiguous sends become `DELIVERY_UNKNOWN`
  and are **never blindly retried**. Real **Brevo** transport behind the 15A
  `EmailTransport` port (mock stays the default; Brevo without a key fails safely at
  DI resolution — never silently mock); the API key is never exposed, logged, or
  committed. Sender is fixed to the **configured verified sender** (only From-Name is
  user-editable). A **secret-guarded** delivery-event webhook driving bounce/complaint/
  unsubscribe → suppression, and a **public opaque-token unsubscribe** page on the
  marketing site (List-Unsubscribe one-click headers, no id/email in the URL).
  Campaign **cancellation**. CRM UI: Email Templates + Email Campaigns (builder,
  preview, test send, audience eligibility preview, campaign detail with live
  recipient statuses) in the Warm Premium design language. **No** inbox, inbound
  replies, SMS, scheduled/recurring sends, or open/click tracking/analytics. See
  `docs/COMMUNICATIONS.md`.

- **Slice 15C — Email Inbox + Inbound Replies + Full Email Threading + Attachments:**
  two-way email managed entirely inside the CRM (no Gmail/IMAP/Graph). A provider-
  independent `EmailInboundAdapter` port (mock + Brevo inbound parsing) feeds a
  normalized inbound service; Brevo is only transport + inbound provider. Each
  conversation gets a high-entropy **opaque thread token** backing a
  `reply-<token>@<reply-subdomain>` address set as the outbound `Reply-To`, so a
  recipient's normal Reply routes back. **Deterministic correlation** (opaque token →
  In-Reply-To → References; **never** subject) plus a **sender-identity check** — a
  mismatch or unmatched mail is safely **quarantined for review**, never appended to
  the wrong thread and never auto-creating a contact. Inbound HTML is **sanitized**
  (scripts/iframes/handlers stripped, remote images/tracking pixels removed); a text
  part is always kept. CRM **replies** are authored in a controlled Markdown subset,
  compiled server-side to safe HTML + text, and **reuse the 15B dispatcher** (a shared
  claim/retry/ambiguous executor across campaign recipients and direct replies; From
  fixed to the verified sender; proper `Message-Id`/`In-Reply-To`/bounded `References`
  headers). **Per-user read state**, derived **needs-reply** (excluding delivery events
  + auto-responders), **archive/restore** (new inbound reopens), and basic **attachments**
  in a **private** bucket (MIME allowlist + size limits, short-lived signed downloads,
  no public URLs). The delivery webhook now also updates reply messages; a **separate**
  secret-guarded, idempotent, size-bounded inbound webhook receives content. Everything
  works in **mock mode** (dev-only `communications:simulate-email-reply`). **No** SMS,
  no Gmail/IMAP/Graph sync, no schedulers/analytics/AI. See `docs/COMMUNICATIONS.md`.

- **Slice 15D — SMS Templates + SMS Campaigns + Two-Way SMS:** the SMS phase, built on
  the same foundations. A real **Twilio Programmable Messaging** adapter behind the 15A
  `SmsTransport` port (mock stays the default; `twilio` without complete credentials
  fails at DI resolution — it never silently mocks), sending through a **Messaging
  Service** so CRM users can never supply a From number. Additive models:
  `CommunicationSmsTemplate` (plain text, no builder), `CommunicationSmsCampaign`
  (immutable body snapshot + aggregate segment estimate) and
  `CommunicationSmsCampaignRecipient` (per-recipient rendered body, encoding and
  segment snapshots). A deterministic **GSM-7 / UCS-2 segment calculator** (160/153 and
  70/67, extended characters costing two septets, two-unit characters never split
  across a boundary) — an estimate, never an invoice — computed **per recipient**
  because merge values change length and encoding. Audience eligibility reuses
  `evaluateChannelEligibility(contact, SMS)` (OPTED_IN required, UNKNOWN never
  eligible), and the SMS dispatcher reuses the **same** Postgres `FOR UPDATE SKIP
  LOCKED` claiming and the **same** shared send-result policy as email, with a
  **second consent/suppression check immediately before each provider call** so a
  recipient who texts STOP after queueing is never sent to. **Two-way SMS**: separate
  signature-verified inbound-content and status-callback webhooks (validated with the
  official Twilio validator against the exact public URL), deterministic correlation on
  (contact number, business number) — never message text — unknown numbers safely
  quarantined for review with **no** auto-created contacts, idempotency on `MessageSid`,
  and monotonic status handling so out-of-order callbacks never regress `delivered`.
  **STOP / START / HELP** are handled from Twilio's authoritative `OptOutType` (with a
  conservative bare-keyword fallback): STOP blocks bulk **and** direct sending, START
  releases only the `USER_OPT_OUT` suppression and re-opts in with an audit trail, HELP
  changes nothing — and the CRM never sends a duplicate acknowledgement or TwiML.
  Live bulk campaigns additionally require an explicit operator **A2P 10DLC**
  acknowledgement. CRM UI: SMS Templates (live character/encoding/segment meter,
  preview, rate-limited test send), SMS Campaigns (wizard + delivery detail), and the
  existing Inbox extended with **Email / SMS channel filters**, an SMS thread and a
  plain-text SMS composer. Everything works in **mock mode** (dev-only
  `communications:simulate-sms`). **No** MMS, scheduled/recurring SMS, link tracking,
  SMS analytics or AI. See `docs/COMMUNICATIONS.md`.

---

## 6. Remaining implementation sequence

```
COMPLETED
  1. Platform Foundation
  2. Identity / Authentication / Authorization / Organizations / RBAC
  3. Discharge Professional Dashboard & Case Workspace
  4. Scope Realignment & Architecture Cleanup
  5. Provider Management + Service Categories + Capacity
  6. Basic Provider Portal
  7. Nonnis Admin Operations Control Center
  8. Website Form Submissions -> Admin Panel + Existing Email Flow (additive)
  9. Referral Workflow + Manual Provider Selection
  10. Tasks + Basic Case Messaging + Unified Timeline
  11. Discharge Readiness Score + Operational Blockers
      Public Website Blog + Short Videos + Testimonials CMS
       (client-requested insertion; Basic Reporting was paused for it)
  12. Basic Reporting + Administrative Reports
  13. Public Residential Provider Directory
  15A. Communications — Foundation + Contacts + Imports + Consent/Suppression
  15B. Email Templates + Visual Email Builder + Email Campaigns
  15C. Email Inbox + Inbound Replies + Full Email Threading + Attachments
  15D. SMS Templates + SMS Campaigns + Two-Way SMS

NEXT (Communications module, remaining phase)
  15E. Unified Communications Inbox + Security + Delivery Hardening   ← next slice

THEN
  14. Full Core-System Audit + Production Hardening
```

> Slice 8 (Website Form Submissions) is **complete and additive**: the public-website
> email + PDF delivery is unchanged; each submission is now also persisted to the
> platform for internal review. See `docs/WEBSITE_FORM_INGESTION.md`.

There are **no** future slices for the Matching Engine, Automation Engine,
Document/Compliance System, Advanced Analytics, or External Integration
Architecture. They are out of scope unless the client explicitly expands it.

---

## 7. Next recommended implementation step

**Communications 15E — Unified Communications Inbox + Security / Delivery Hardening:**
the final Communications phase — consolidate the email + SMS inbox UX (routes are still
email-scoped aliases from 15C/15D), and harden communications security and delivery
across both channels. Do NOT begin automatically. (Communications 15A–15D are complete;
see `docs/COMMUNICATIONS.md`.)

---

## 7b. Later: Full Core-System Audit + Production Hardening

After the Communications module (15E) completes, the final planned slice is an
end-to-end review
and hardening pass across the completed core system — security/RBAC/tenant-isolation
audit, input validation, error handling, performance and index review, dependency
and config/secret hygiene, and production-readiness checks. No new product scope; no
excluded advanced modules. (Public Residential Provider Directory — item 13 — is
complete; see `docs/RESIDENTIAL_DIRECTORY.md`.)
