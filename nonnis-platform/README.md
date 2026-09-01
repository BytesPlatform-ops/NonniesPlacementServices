# Nonnis Digital Optimization Platform

An internal operations platform for coordinating **post-discharge care**, built as a
**modular monolith** alongside — but fully separate from — the existing public
Nonnis marketing website.

The central business object is the **discharge case**. All architecture is
designed around a case moving through its lifecycle:

```
intake → requirements → manual provider search/selection → referrals →
provider responses → coordination → discharge → service commencement →
follow-up → completion
```

Provider selection is **manual** throughout: a user searches and filters
providers and chooses one by hand. There is no automated matching or
recommendation engine (see **Current agreed scope** below).

It is not a staffing / job platform. It will eventually serve three user groups —
**Discharge Professionals**, **Service Providers**, and **Nonnis Operations Staff** —
though only the operational case foundation is implemented so far.

---

## Architecture

Two separate applications:

| App        | Stack                                             | Dev port |
| ---------- | ------------------------------------------------- | -------- |
| `backend`  | Node.js · TypeScript · NestJS · Prisma · Postgres | `4000`   |
| `frontend` | Next.js (App Router) · TypeScript · Tailwind      | `3001`   |

- REST API, versioned under `/api/v1`, with a normalized `{ data }` / error envelope.
- Modular NestJS boundaries; DTO validation; centralized exception handling;
  structured-logging-ready; future background-job / notification / event / audit
  ready. No microservices.
- Frontend has a reusable component design system, a typed API client layer, and a
  role-aware, accessible foundation.

These ports and configs are independent of the public website (which runs on its own
default Next.js port).

---

## Repository structure

```
nonnis-platform/
  README.md
  backend/
    prisma/
      schema.prisma
      migrations/            # initial SQL migration (generated offline)
    src/
      common/                # filters, interceptors, decorators, dtos, shared types
      config/                # typed env configuration
      database/              # PrismaModule / PrismaService (lazy connection)
      modules/
        health/              # GET /health
        cases/               # discharge case API (list / detail / create)
        workflow-events/     # append-only business workflow history
        audit/               # append-only security/admin audit history
      app.module.ts
      main.ts
  frontend/
    src/
      app/                   # routes: /, /cases, /cases/[id]
      components/            # ui/ (design system) + layout/ (shell)
      features/cases/        # case list + detail feature views
      hooks/                 # useAsync
      lib/                   # api-client, config, format, utils, case-status
      services/              # cases.service (API calls)
      types/                 # domain + api contract types
    public/
```

---

## Implemented scope (this foundation)

**Backend**

- Prisma schema for the core domain: `Organization`, `Facility`, `Patient`, `Case`,
  `ServiceRequest`, `CaseRequirement`, `WorkflowEvent`, `AuditEvent` (UUID primary
  keys everywhere; enums for organization type, case status, care setting, service
  category, level of care, requirement category, workflow event type/source).
- Initial SQL migration generated offline (`prisma/migrations/*/migration.sql`).
- `GET /health`
- `GET /api/v1/cases` — paginated, filterable by status.
- `GET /api/v1/cases/:id` — full case detail (404 when missing, 400 for a bad UUID).
- `POST /api/v1/cases` — transactional create: validates input, creates or
  associates the patient, validates facility ↔ organization, creates the case with
  nested service requests + requirements, writes the initial `WorkflowEvent` and an
  `AuditEvent`, and returns the normalized case detail.
- Global validation pipe, centralized exception filter (maps Prisma errors), and the
  response-envelope interceptor.

**Frontend**

- Operations design system: sidebar, top bar, page heading, data table, status
  badge, panel/info card, description list, empty / loading / error states, timeline.
- `/cases` — first functional screen: real API data, status filter, pagination, and
  loading / empty / error states.
- `/cases/[id]` — case overview, patient, originating facility, discharge
  information, service requests, requirements, current status, and recent workflow
  events.

**Tests**

- Backend (Jest): health endpoint, case-list envelope, invalid-UUID (400),
  not-found (404), invalid-body validation (400), and case-service unit tests
  (create validation guards, happy-path orchestration with workflow + audit, facility
  ownership check, list, detail).
- Frontend (Vitest): utility + status-metadata behavior.

---

## Current agreed scope

The authoritative scope definition lives in [`SCOPE.md`](./SCOPE.md). In short, the
platform covers **standard operational/admin functionality**: users, roles &
permissions, organizations, facilities, providers & provider profiles/services/
availability, service categories, discharge cases, intake, requirements, service
requests, case assignment, manual workflows, referrals, provider responses, tasks,
basic case communication, basic operational dashboards, basic reporting, general
platform administration, and a public residential provider directory.

Standard **provider management** (provider profiles, services, geographic coverage,
payment/insurance types, languages, operating hours, eligibility, capacity, status,
search/filter) and the admin-managed **service-category / payment-type / language**
catalogs are now implemented (see **Provider directory** below).

The **Provider Portal** (self-service for provider users) and the **Nonnis Admin
Operations Control Center** (cross-org operational oversight) are now implemented
(see below).

Public-website form submissions are now **additionally persisted** into the platform
(alongside the unchanged email/PDF flow) — see **Website form submissions** below.

The **Referral Workflow** (manual provider selection → provider response →
placement → service start), **Tasks + Case Messaging + Unified Timeline**, and
**Discharge Readiness + Operational Blockers** are now implemented (see the
corresponding sections below).

Not yet built but **in scope** for later slices (next first): basic
reporting/exports and the public provider directory.

### Excluded advanced modules — DO NOT BUILD

Five large systems are explicitly **out of scope**. Do not implement them, and do
not grow existing features into them:

1. **External API & Integration Architecture** — EHR/hospital/insurance
   integrations, FHIR interoperability, reconciliation, data-mapping/retry engines,
   integration monitoring. *(The app's own internal `/api/v1` REST API is required
   and unaffected — this exclusion is only the dedicated external-integration
   platform.)*
2. **Workflow Automation Engine** — configurable event-condition-action rules, rule
   builders, automated deadlines/escalations/reminders, background automation
   orchestration. *(Manual workflows, case status transitions, `WorkflowEvent`
   history, manual assignment, and deterministic attention indicators remain — they
   are business history and operational UI, not an automation engine.)*
3. **Provider Matching Engine** — eligibility filtering engines, weighted scoring,
   ranking, match percentages, recommendation/ML matching, automated selection.
   *(Provider selection is manual CRUD search/filter only.)*
4. **Advanced Analytics & Reporting** — analytics event pipelines, scorecards,
   trend/cohort analysis, predictive metrics, BI/warehouse architecture. *(Basic
   operational counts, grouped summaries, simple filters, and administrative reports
   remain in scope.)*
5. **Document & Compliance Management System** — document management/versioning,
   approval workflows, credential verification/expiration tracking, compliance
   dashboards/rules engines, e-signature, virus scanning. *(Simple informational
   provider-profile fields — e.g. license number as plain metadata — are allowed if
   genuinely needed, but must not become tracking/verification workflows.)*

`WorkflowEvent` and `AuditEvent` are **core** and remain: the former is business/
activity history, the latter is administrative-security accountability. Neither is an
excluded module.

---

## Backend setup

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
cd nonnis-platform/backend
cp .env.example .env          # then set DATABASE_URL
npm install
npm run prisma:generate       # generate the Prisma client
npm run prisma:migrate        # apply migrations to your database (needs DATABASE_URL)
npm run start:dev             # http://localhost:4000
```

Commands: `npm run typecheck` · `npm run lint` · `npm run build` · `npm test`.

If you do not yet have Postgres, the schema, client generation, and the initial SQL
migration are all still available; only `prisma:migrate` and live queries require a
database.

### Backend environment variables

| Variable       | Purpose                                | Example                                                       |
| -------------- | -------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`               | Postgres connection string for Prisma      | `postgresql://user:pass@host:6543/postgres?pgbouncer=true` |
| `DIRECT_URL`                 | Direct/session-pooler URL for migrations    | `postgresql://user:pass@host:5432/postgres`                |
| `PORT`                       | API port                                    | `4000`                                                     |
| `FRONTEND_URL`               | Allowed CORS origin for the frontend        | `http://localhost:3001`                                    |
| `SUPABASE_URL`               | Supabase project URL                        | `https://[ref].supabase.co`                                |
| `SUPABASE_ANON_KEY`          | Supabase anon key (token verification)      | *(from Supabase dashboard)*                                |
| `SUPABASE_SERVICE_ROLE_KEY`  | **Secret** — admin ops (invites) only       | *(backend only; never sent to the frontend)*               |

---

## Frontend setup

```bash
cd nonnis-platform/frontend
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL
npm install
npm run dev                    # http://localhost:3001
```

Commands: `npm run typecheck` · `npm run lint` · `npm run build` · `npm test`.

### Frontend environment variables

| Variable                        | Purpose                             | Example                     |
| ------------------------------- | ----------------------------------- | --------------------------- |
| `NEXT_PUBLIC_API_URL`           | Base URL of the backend API         | `http://localhost:4000`     |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL (public)       | `https://[ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public/safe)     | *(from Supabase dashboard)* |

---

## Database

- Schema: `backend/prisma/schema.prisma`.
- Initial migration: `backend/prisma/migrations/<timestamp>_init/migration.sql`
  (generated with `prisma migrate diff`, so it exists without a live database).
- Apply with `npm run prisma:migrate` (or `prisma migrate deploy` in CI/production)
  once `DATABASE_URL` points at a real Postgres instance.

---

## Identity, authentication & access control

- **Authentication** is provided by **Supabase Auth**. The backend verifies access
  tokens server-side (signature validated via Supabase, not merely decoded) behind
  a mockable `TokenVerifier`. Passwords are never stored in Prisma.
- **Authorization is enforced in the backend.** A global `AuthGuard` resolves the
  application user + active-organization context; a global `PermissionsGuard`
  enforces `@RequirePermissions` / `@RequireAnyPermission`. Nothing trusts the
  browser's role, org id, or user id.
- **RBAC:** roles map to permissions (seeded, idempotent). System roles:
  `NONNIS_ADMIN`, `NONNIS_OPERATIONS`, `DISCHARGE_PROFESSIONAL`, `PROVIDER_ADMIN`,
  `PROVIDER_STAFF`. Permission codes cover platform/orgs/users/facilities/cases/audit.
- **Multi-tenancy:** organization-scoped requests carry `X-Organization-Id`, which
  the backend re-validates against active membership. Case, facility and user
  queries are bounded by organization; cross-org detail access returns 404 to avoid
  revealing record existence. `cases.read_all` is seeded for a future platform-wide
  Operations view (not built here).
- **Role escalation is prevented:** a provider admin can only assign/manage provider
  roles within its own organization; it can never grant Nonnis roles.
- **Audit:** administrative actions (organization/user/membership/facility changes)
  write `AuditEvent` records with safe metadata (no secrets/tokens).

Key endpoints added: `GET /api/v1/auth/me`; `GET/POST/PATCH /api/v1/organizations`
(+`/status`); `GET/POST/PATCH /api/v1/facilities` (+`/status`);
`GET /api/v1/users`, `GET /api/v1/users/assignable-roles`, `POST /api/v1/users/invite`,
`PATCH /api/v1/users/:id`, `.../status`, `.../memberships/:membershipId`. The existing
`/api/v1/cases` endpoints are now authenticated and organization-scoped.

### Seed & bootstrap

```bash
cd nonnis-platform/backend
npm run prisma:seed                    # idempotent roles + permissions
npm run bootstrap:admin -- you@org.com # first NONNIS_ADMIN (email supplied by you)
```

`bootstrap:admin` is idempotent and requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
It never hardcodes an email or secret.

## Discharge case workspace (this slice)

- **Dashboard** (`GET /api/v1/dashboard/discharge-professional`) — aggregates for the
  active organization: assigned-to-me, overdue, due-soon, needing-attention,
  missing-info, blocked-requirement counts; expected-discharge buckets
  (overdue/today/24h/3d/7d/later/none, timezone-safe UTC day math); and case +
  activity shortlists. Frontend at `/dashboard`.
- **Case attention** — a deterministic, non-AI `case-assessment` module returns
  structured attention reasons (`code`, `severity` INFO/WARNING/CRITICAL, `label`)
  and completeness (percentage, checks, missing, blockers) from current facts only.
  Related to, but distinct from, the Discharge Readiness evaluation (Slice 11); they
  share deterministic helpers.
- **Case list** — server-side filtering (`search`, `status`, `facilityId`,
  `assignedToMe`, `assignedUserId` (permission-gated), `expectedFrom/To`, `overdue`,
  `attentionOnly`, `incompleteOnly`), whitelisted `sort`/`order`, pagination, and
  per-row completeness/blockers/attention.
- **Case create/edit** — `POST /cases`, `PATCH /cases/:id` (terminal cases are not
  editable); sectioned intake at `/cases/new` with new-or-existing patient.
- **Requirements** & **service requests** — `GET/POST/PATCH /cases/:id/requirements`
  and `.../service-requests` (+ `DELETE` cancel). RequirementStatus enum
  (PENDING/IN_PROGRESS/BLOCKED/COMPLETE/NOT_REQUIRED); blocked/incomplete required
  items raise attention.
- **Assignment** — `PATCH /cases/:id/assignment` (permission `cases.assign`),
  validates the assignee has an active, case-capable membership in the case's org;
  records CASE_ASSIGNED/REASSIGNED/UNASSIGNED workflow events (+ audit on reassign).
- **Status transitions** — `POST /cases/:id/transition` via a centralized policy.
  This slice permits only DRAFT ⇄ READY_FOR_REVIEW and → CANCELLED; DRAFT →
  READY_FOR_REVIEW is gated on completeness and returns structured blockers (422).
  Later statuses remain readable and are driven by future modules.
- **Workspace UI** — `/cases/[id]` with Overview / Assessment / Service Requests /
  Requirements / Activity tabs, attention header, completeness meter, and timeline.
- **Theme** — the platform UI was aligned to the public site's "Warm Premium
  Placement" brand (umber/bronze/antique-gold on warm ivory, Fraunces + Inter),
  adapted for a calm, dense operations console.

## Provider directory (Slice 5)

A Nonnis-managed provider directory for **manual** provider selection — no matching,
scoring, ranking, or compliance workflows.

- **Provider** is one-to-one with a `PROVIDER` `Organization` (the org owns the legal
  identity; the provider owns operational/directory detail). Simple status
  `ACTIVE / INACTIVE / PAUSED`.
- **Endpoints:** `GET/POST /providers`, `GET/PATCH /providers/:id`,
  `PATCH /providers/:id/status`, `GET /providers/:id/users`, and per-provider
  sub-resources for `services`, `coverage`, `payment-types`, `languages`, `hours`
  (`PUT`), and `capacity` (`PUT`). Admin catalogs: `GET/POST/PATCH
  /service-categories` (+`/status`), `/payment-types`, `/languages`.
- **Search/filter** (`GET /providers`): `q`, `status`, `serviceCategoryId`, `state`,
  `city`, `postalCode`, `languageId`, `paymentTypeId`, `availability`, whitelisted
  `sort`/`order`, pagination. Explicit filtering only — never suitability ranking.
- **Isolation:** Nonnis staff manage all providers; Provider Admin/Staff are bounded
  to their own organization's provider (cross-provider access → 404). Provider users
  reuse the existing `User` + `OrganizationMembership` model. New permissions:
  `providers.read/manage/manage_own`, `service_categories.read/manage`,
  `provider_capacity.manage/manage_own`.
- **Capacity** is a simple current-availability record (optionally per category);
  history is captured via `AuditEvent`. No forecasting/scheduling/analytics.
- **Service categories** are an admin-managed catalog (`ServiceCategory` model);
  the legacy `ServiceCategoryCode` enum was preserved (renamed, non-destructive) and
  `ServiceRequest` gained an additive nullable `serviceCategoryId` link.
- **UI:** `/providers` (directory + management, permission-aware), `/providers/new`,
  `/providers/[id]` (Overview / Services / Coverage / Payment / Languages / Hours /
  Capacity / Users tabs), and `/admin/service-categories` (catalog admin).

## Provider portal (Slice 6)

A self-service portal for **Provider Admin / Provider Staff** to maintain their own
provider organization's information — no referrals, matching, automation, compliance,
or analytics.

- **Provider context** is derived server-side from the caller's active organization
  (`GET /api/v1/provider-portal/me`), never from a browser-supplied id. The response
  carries the provider detail (internal notes excluded), a deterministic profile
  **completeness** summary (transparent missing-info checks — not a score), and
  operational counts. All mutations reuse the Slice 5 `/providers/:id/*` endpoints,
  which re-validate ownership via `ProviderAccessService` (cross-provider → 404).
- **Isolation hardening:** provider-org users (admin and staff) are org-scoped for
  reads; **internal notes** and **provider status** are Nonnis-only — provider users
  can neither read nor write internal notes, and cannot change their own status.
- **Permissions:** Provider Admin (`providers.manage_own`) edits profile/services/
  coverage/payment/languages/hours and (`users.manage_own_organization`) invites
  teammates to provider roles only. Provider Staff are read-only except capacity
  (`provider_capacity.manage_own`).
- **Routing:** `/provider` (overview), `/provider/{profile,services,coverage,payment,
  languages,hours,capacity,team}`. A role-aware landing (`/home`) sends provider-org
  users to the portal; other roles keep the operations console. The sidebar swaps to
  portal navigation when the active organization is a provider.

## Operations control center (Slice 7)

A Nonnis-only, cross-organization operational surface at `/operations`, gated by
`cases.read_all` (held only by `NONNIS_ADMIN` / `NONNIS_OPERATIONS`).

- **Endpoints:** `GET /api/v1/operations/summary` (platform-wide counts: active,
  attention, overdue, due-today/-this-week, unassigned, blocked, incomplete +
  active/no-capacity/unavailable providers + recent workflow activity),
  `GET /operations/cases` (cross-org case queue with search, org/facility/status/
  assignee/date filters and overdue/attention/blocked/incomplete/unassigned toggles),
  `GET /operations/cases/:id/assignees` (eligible reassignment targets), and
  `GET /operations/providers` (delegates to the Slice 5 provider list, with added
  `noServices` / `noCoverage` operational filters).
- **Reuse, not duplication:** the deterministic attention/overdue/incomplete
  where-clauses are shared with the case list via `cases/case-query.ts`; quick
  actions (reassign, block/unblock, transition) reuse the existing `/cases/:id`
  endpoints, which already honour `cases.read_all` cross-org. No new mutation logic.
- **Isolation:** operations is the only platform-wide read surface; ordinary
  org-scoped case/provider routes remain tenant-bound. Role-aware landing sends
  Nonnis staff to `/operations`, provider users to `/provider`, others to `/cases`.
- **UI:** `/operations` (metrics + attention queue + recent activity),
  `/operations/cases` (full filterable queue with reassign/block actions), and
  `/operations/providers`. No referral/matching/analytics/compliance widgets.

## Website form submissions (Slice 8)

The public website's six forms all POST to one handler (`src/app/api/forms/submit/route.ts`).
After the existing email + branded-PDF delivery, that handler now **also** persists a
normalized copy of the submission to the platform — additive, never replacing the
email/PDF flow.

- **Server-to-server ingest:** the website's `server-only` helper POSTs to
  `POST /api/v1/form-submissions/ingest`, authenticated by a shared `X-Ingest-Token`
  (backend-only secret, never in the browser). The endpoint is `@Public` (not user
  auth) but token-guarded, and idempotent on the website's reference id.
- **Safety:** only normalized text answers (`sections`) + processing metadata are
  stored — **never** uploaded file bytes or secrets. Persistence failure is caught,
  logged by reference id only, and never breaks the email/PDF response.
- **Admin:** Nonnis staff review submissions at `/operations/form-submissions`
  (`form_submissions.read/manage`; NONNIS_ADMIN + NONNIS_OPERATIONS only) — filterable
  table + detail drawer with a manual NEW/IN_REVIEW/RESOLVED/ARCHIVED workflow, notes,
  and optional case/provider links. No document-management system, automation, or
  auto-creation of cases. Full detail in [`docs/WEBSITE_FORM_INGESTION.md`](./docs/WEBSITE_FORM_INGESTION.md).

## Referral workflow (Slice 9)

Connects the case and provider domains with an entirely **manual** referral flow — no
matching, scoring, ranking, or recommendation anywhere.

- **Models:** `Referral` (DRAFT/SENT/VIEWED/INFORMATION_REQUESTED/
  CONDITIONALLY_ACCEPTED/ACCEPTED/DECLINED/WITHDRAWN/CANCELLED, reference
  `REF-YYYY-XXXXXX`), append-only `ReferralResponse` history, and `Placement`
  (ACCEPTED→COORDINATING→SCHEDULED→STARTED/UNSUCCESSFUL). Transitions are enforced by
  a centralized server-side policy.
- **Staff API:** `GET /cases/:id/referrals`, `POST /cases/:id/service-requests/:srId/referrals`,
  `GET /referrals/:id`, `POST /referrals/:id/{send,withdraw,information,resend-notification}`,
  `PATCH /referrals/:id/placement`, `GET /operations/referrals`
  (`referrals.read/manage/read_all`).
- **Provider API:** `GET /provider-portal/referrals`, `GET /provider-portal/referrals/:id`
  (records `viewedAt` once), `POST …/respond`, `PATCH …/{assignment,schedule}`,
  `POST …/{confirm-start,report-unsuccessful-start}` (`referrals.respond_own`).
  Provider referral views are minimum-necessary serializers — internal notes and
  unrelated case data are never exposed; cross-provider access → 404.
- **Manual selection:** from a case service request, staff open a provider picker over
  the existing directory with **visible** filters (optionally prefilled from the
  service request) and choose a provider explicitly, then draft or send.
- **Notification:** a basic transactional email (nodemailer, mockable transport) to
  active provider admins (else the provider email) with the reference, a generic
  service label, due date, and a secure portal link — no patient/clinical detail.
  Delivery failure is recorded as `FAILED` (referral preserved) with a manual resend;
  no automated retry/escalation.
- **Distinct events:** referral accepted, service scheduled, patient discharged, and
  service actually started are never conflated. The case only reaches `ACCEPTED` when
  every service request has an accepted placement.
- **UI:** case workspace **Referrals** tab (create/send/withdraw/clarify per service
  request), provider portal **Referrals** inbox + detail with Accept / Conditionally
  Accept / Request Information / Decline dialogs and service-start controls, and an
  Operations referral queue. All referral/placement events appear in the case timeline.

## Tasks, messaging & unified timeline (Slice 10)

Three distinct, entirely manual concepts on a case — no automation, reminders, or
escalation anywhere.

- **Tasks** (`Task`): OPEN/IN_PROGRESS/COMPLETED/CANCELLED, LOW/NORMAL/HIGH/URGENT.
  Overdue is **derived** at read time (due & still open/in-progress), never a stored
  status. Endpoints: `GET/POST /cases/:id/tasks`, `GET /cases/:id/task-assignees`,
  `GET /tasks` (mine), `GET /operations/tasks`, `GET/PATCH /tasks/:id`,
  `POST /tasks/:id/{start,complete,cancel}` (`tasks.read/manage/read_all`). Assignees
  must be active members of the case org or Nonnis staff — validated, never trusted.
- **Messages** (`Message`, append-only) with three visibility scopes decided by a
  centralized `MessageAccessService`: **CASE_TEAM** (`/cases/:id/messages` — case org
  + Nonnis; providers excluded), **NONNIS_INTERNAL** (`/cases/:id/internal-notes` —
  `internal_notes.manage` only), **PROVIDER_REFERRAL** (`/referrals/:id/messages` —
  the referral's provider **or** the case/Nonnis side; one provider never sees
  another's thread). The formal referral clarification workflow (ReferralResponse) is
  untouched; referral messages are for ordinary follow-up.
- **Unified timeline** (`GET /cases/:id/timeline`, `cases.read`): one viewer-aware
  history merging WorkflowEvents with the messages the viewer may see (internal notes
  only for `internal_notes.manage`; providers cannot reach it), filterable
  (all/case/tasks/messages/referrals), paginated — no duplicated entries.
- **UI:** case workspace **Tasks**, **Communication** (case-team + clearly-labelled
  Nonnis-only internal notes), and unified **Activity** tabs; a **My Tasks** page and
  sidebar item; a discharge-dashboard task widget (overdue / due-today / high-urgent);
  an **Operations** task queue; and referral-thread messaging in both the staff
  referrals tab and the provider referral detail. No attachments or analytics.

## Discharge readiness & operational blockers (Slice 11)

Deterministic, explainable readiness — **NOT** AI, prediction, scoring engines,
matching, analytics, or automation. Readiness is always computed **live** from
source-of-truth records; there is no persisted readiness column and no schema change.

- **Domain** (`readiness-domain.ts`, pure/unit-tested): transparent **components**
  (COMPLETE / INCOMPLETE / BLOCKED / NOT_APPLICABLE), a **percentage** over applicable
  components (NOT_APPLICABLE excluded), **mandatory gates**, and normalized
  **blockers** (INFO / WARNING / CRITICAL). Percentage and readiness are separate:
  a high percentage **never** makes a case ready. `ready` is true only when **every**
  gate passes — case active, not manually blocked, case information complete, discharge
  professional assigned, service requests complete, no blocked/incomplete required
  requirement, an accepted (non-cancelled, non-unsuccessful) placement for **every**
  active service request, a scheduled service start for each accepted placement, and
  consistent discharge dates. Conditional acceptance and cancelled/unsuccessful
  placements never satisfy the placement gate. Transportation, equipment, and funding
  are informational (they lower the percentage and raise WARN/INFO blockers, but do not
  gate). Distinct from — and shares helpers with — the existing Case Attention model.
- **Live derivation & efficiency:** a single case reads one composed query; list /
  dashboard / operations surfaces use count/`where` fragments only (never a deep query
  per row).
- **API:** `GET /cases/:id/readiness` (`cases.read`; case-org or `cases.read_all`;
  providers excluded). Manual, explicit lifecycle actions (`cases.update`):
  `POST /cases/:id/mark-ready-for-discharge` (all gates must pass, else structured
  blockers), `POST /cases/:id/mark-discharged` (requires READY_FOR_DISCHARGE + an
  explicit `actualDischargeDate` — discharge is never inferred),
  `POST /cases/:id/mark-service-started` (discharged + every required placement STARTED;
  case-level SERVICE_STARTED is never set from a single placement), and
  `POST /cases/:id/mark-completed` (deterministic completion eligibility). Readiness
  **never** self-transitions status; regressions surface as `statusMismatch` and are
  never auto-bounced. Each action writes a `STATUS_CHANGED` WorkflowEvent (+ AuditEvent)
  with the real actor. `GET /operations/readiness/summary` (`cases.read_all`).
- **UI:** a workspace **Readiness** tab (percentage dial, level, gates summary,
  component checklist, blockers with links to the relevant tab, and the discharge
  actions), a header readiness badge, a discharge-dashboard readiness widget, and
  Operations readiness counts plus server-side queue filters (ready / not-ready /
  critical blocker / placement missing / service unscheduled / near-term-not-ready /
  discharged-not-started).

## Public website content CMS (blog / short videos / testimonials)

A focused `content` module lets Nonnis staff manage what the **public marketing
website** shows — with a strict split between admin management and public reads.

- **Models:** `BlogPost` (Markdown-subset `body`, unique SEO `slug`,
  DRAFT/PUBLISHED/ARCHIVED `status`, `publishedAt`, optional category/author/meta),
  `ShortVideo` (`videoUrl` + `posterImageUrl` + `sourceLabel`, `active`, `sortOrder`,
  optional `blogPostId`), and `Testimonial` (`quote` + optional attribution,
  `active`/`featured`/`sortOrder`, plus **Nonnis-only `internalNotes`**). Additive
  migration `20260901000000_content_cms`; no existing table changed.
- **Permissions:** `content.read` / `content.manage` — held by NONNIS_ADMIN and
  NONNIS_OPERATIONS only. Provider users and discharge professionals have neither, so
  the CMS is invisible and inaccessible to them.
- **Public API** (`@Public()`, no login, read-only): `GET /public/blog` (published
  cards, **no body**), `GET /public/blog/:slug` (published detail; 404 for
  drafts/archived/unknown), `GET /public/blog-videos` (active), `GET /public/testimonials`
  (active, featured first). Serializers expose only public-safe fields — never drafts,
  `internalNotes`, `status`, or user/admin metadata.
- **Admin API** (permission-gated + audited): `blog-posts` (list/get/create/update +
  `publish`/`unpublish`/`archive`/delete), `short-videos` and `testimonials`
  (list/get/create/update/`:id/active`/delete). Actor is server-derived; every mutation
  writes an `AuditEvent`. Body/URL/slug/length validated; blog bodies are a safe Markdown
  subset rendered without raw HTML (no stored XSS).
- **Public website:** a `/blog` index (featured + grid), a `/blog/[slug]` detail with a
  dependency-free Markdown renderer + `generateMetadata` (canonical + OG) + `sitemap.ts`
  / `robots.ts`, a premium horizontal **short-video strip** (drag/swipe, centered play,
  single-video lightbox — never autoplays multiple, audio only after an explicit click),
  and a flowing **homepage testimonials marquee** (pauses on hover, respects
  `prefers-reduced-motion`). Content is fetched server-side via `NONNIS_PLATFORM_API_URL`;
  if it is unset or the API is down, sections degrade gracefully (empty/hidden) rather
  than crashing. A **Content** nav group (Blog / Short Videos / Testimonials) appears in
  the CRM sidebar. No page-builder, media transcoding, content analytics, AI generation,
  or scheduled publishing.
- **Media & connectivity (repair):** CMS media lives in the public-read Supabase
  Storage bucket **`nonnis-content`** (`blog/featured/`, `videos/`, `videos/posters/`).
  Uploads go direct browser→Supabase via a backend-minted signed URL
  (`POST /content/media/upload-url`, `content.manage`); each record stores both the
  public URL and a managed storage path for safe replace/delete. The website builds all
  platform URLs through one shared helper (`NONNIS_PLATFORM_API_URL`, with a dev-only
  localhost fallback; 30s ISR). The blog body uses a selection-aware **rich Markdown
  editor** (toolbar, H1–H6, ⌘/Ctrl+B/I/K, ⌘/Ctrl+Alt+1–6, Write/Split/Preview). Full
  env, MIME/size rules, the `content:seed-media` command, and the `test:smoke` runtime
  check are in [`docs/WEBSITE_CONTENT_CMS.md`](docs/WEBSITE_CONTENT_CMS.md).

## Platform action UX (confirm + toast + pending)

Consequential and destructive mutations across the whole CRM follow one reusable
flow — **click → branded confirmation dialog → pending state → API → success/error
toast → targeted UI update** (never a full-page reload, never `window.confirm`).

- **`ConfirmProvider` / `useConfirm`** (`src/providers/confirm-provider.tsx`): an
  accessible dialog (`role="dialog"`, focus trap, Escape/backdrop cancel, focus
  returned to the trigger) with `default` / `warning` / `danger` variants and
  contextual copy — it explains the real consequence, not "Are you sure?".
- **`ToastProvider` / `useToast`** (`src/providers/toast-provider.tsx`):
  success/error/info/warning toasts, auto-dismiss, manual dismiss, capped stack,
  `role="status"`/`"alert"`.
- **`MutationButton`** (`src/components/ui/MutationButton.tsx`) + **`useAction`**
  (`src/hooks/use-action.ts`, pure core in `src/lib/perform-action.ts`): wire the
  above together — a button disables itself while pending (duplicate-click safe),
  shows a pending label, toasts the outcome, and calls `onSuccess` (targeted
  `reload()` / local update). Both providers mount in `app/(app)/layout.tsx`.

Converted domains: content (blog/videos/testimonials), users (suspend/reactivate,
role), organizations/facilities/service-categories (activate/deactivate), cases
(cancel/transition/assign, service-request cancel, requirement status), tasks
(start/complete/cancel), referrals (send/resend/withdraw) and provider-portal
referral responses, providers (status, service/coverage/payment/language
remove & activate), operations (block/unblock/assign) and form-submission review.
Destructive actions (delete, cancel, withdraw, suspend, archive, remove) use the
`danger` variant; routine form saves are deliberately *not* gated by confirmation.

## Administrative reporting (Slice 12)

A Nonnis-only `reports` module answers straightforward administrative questions
over **current** database state — counts, groupings, and filtered lists. It is
**basic reporting, not analytics**: no warehouse, trends, comparisons, scoring,
ranking, prediction, scheduling, or custom report builder.

- **Access:** new `reports.read` / `reports.export` permissions, granted only to
  **Nonnis Admin** and **Nonnis Operations**. Access is enforced by the backend
  `PermissionsGuard`, not just by hiding the nav. Reporting queries are
  intentionally cross-organization and live inside the reports services; the
  ordinary tenant-scoped APIs are untouched.
- **Endpoints:** `GET /api/v1/reports/overview` (counts only), plus `cases`,
  `referrals`, `providers`, `readiness`, `tasks`, and `form-submissions` reports,
  each returning `{ appliedFilters, summary, groups, items, page, pageSize, total,
  totalPages }` with server-side date / organization / facility filtering, search,
  whitelisted sort, and pagination. `GET /api/v1/reports/filter-options` feeds the
  filter dropdowns.
- **One definition everywhere:** reports reuse existing business logic — active-case
  statuses (`case-query`), the deterministic readiness domain (`computeReadiness`
  is run live per displayed row, bounded to the page — no N+1) with its shared
  `readiness-query` WHERE fragments, a shared `referralOverdueWhere`, and existing
  enums. Nothing is re-implemented.
- **CSV export** (`reports.export`): every dataset exports with the same on-screen
  filters, sanitized against spreadsheet formula-injection (`sanitizeCsvCell`),
  capped at 10,000 rows (`422` otherwise), streamed as UTF-8 with a dated filename
  (`nonnis-<type>-YYYY-MM-DD.csv`). Each export writes a lightweight
  `report.exported` audit event (actor, report type, safe filter summary, row
  count — never the rows). `Content-Disposition` is CORS-exposed so the browser
  keeps the dated filename.
- **Minimum-necessary data:** reports never expose clinical notes, internal notes,
  message bodies, or the raw `submittedData` JSON; full details stay in the
  existing detail screens (rows link to them).
- **UI:** a **Reports** nav group and `/reports` hub + one page per dataset, in the
  Warm Premium design language — compact filter bar, active-filter chips, reset,
  URL/query filter state (refresh- and link-safe), summary metric cards (counts
  only), grouped-count tables, responsive scrolling tables with server-side
  pagination, loading/empty/error states, toast-driven CSV export, and a
  **Print** action (browser print; app chrome and controls hidden, report title +
  generated timestamp + applied period/scope preserved). Default period is the last
  30 days, shown in the URL and clearable.

Full details are in [`docs/REPORTING.md`](docs/REPORTING.md).

## Public residential directory (Slice 13)

The existing internal **Provider** records are the single source of truth; a public
family-facing directory on the marketing website surfaces the ones Nonnis chooses to
publish. No second provider database.

- **Minimal additive fields** on `Provider` (`isResidentialProvider`,
  `publicListingEnabled`, unique `publicSlug`, `publicDescription`,
  `publicFeaturedImageUrl`/`publicFeaturedImageStoragePath`, `publicSortOrder`,
  `publicPublishedAt`) — all default **OFF**, so no existing provider is auto-published
  and canonical fields (name, description, phone, email, website, city, state) stay the
  public source.
- **Nonnis-only publishing** (`providers.manage`; provider-portal users cannot
  self-publish). `PATCH /providers/:id/public-listing`, `…/publish`, `…/unpublish`.
  Publish is gated by deterministic validation (residential + ACTIVE + display name +
  valid unique slug + city/state + ≥1 active service); failures return structured
  `missing` fields. Publish/unpublish/update write `provider.published` /
  `provider.unpublished` / `provider.public_listing_updated` **AuditEvents** (never
  case `WorkflowEvent`s).
- **Public read-only API** (`@Public()`): `GET /api/v1/public/residential-providers`
  (search `q`, `state`, `city`, `serviceCategory`, `language`, `paymentType`,
  `sort`, `page`, `limit`), `/:slug`, and `/options`. All are hard-gated to
  ACTIVE + residential + published and use an **explicit public serializer** — no
  internal notes, capacity, provider users, ids, or storage paths.
- **Public website** (`/residential-providers` + `/residential-providers/[slug]`),
  distinct from the business-facing `/providers` (untouched, along with the "List
  Your Community" form). Image-led cards, server-side search/filter/sort,
  pagination, a mobile filter drawer, a detail page with SEO metadata and
  conservative `LocalBusiness` structured data (no fabricated reviews/ratings), and
  sitemap entries for published providers only.
- **Media** reuses the CMS Supabase Storage signed-upload architecture under
  `providers/public/…` via a provider-scoped endpoint and the shared `MediaUpload`
  component; the **Website Listing** admin tab (Warm Premium; confirm/toast/
  `MutationButton`) manages residential classification, slug, description, image,
  order, and publish/unpublish, with a "Published / Not published / Missing
  information" state and a **View on website** link.
- **Demo data:** `npm run seed:public-directory-demo` (idempotent; `-- --clean`
  removes it) seeds clearly-fictional demo communities using existing Supabase images.

Out of scope and confirmed absent: matching/scoring/ranking, reviews/ratings,
subscription billing/Stripe, public capacity exposure, family accounts, favorites,
and public referral creation. Full details in
[`docs/RESIDENTIAL_DIRECTORY.md`](docs/RESIDENTIAL_DIRECTORY.md).

## Communications — Foundation (Phase 15A)

The first phase of a new **Communications** module: a dedicated marketing/outreach
contact database. It is **separate** from User/Patient/Provider identities and
never references Case/Patient records — a deliberate PHI boundary. Brevo (email)
and Twilio (SMS) are **future transport providers only**; they never own this data
model, and this phase makes **no** live provider calls and sends nothing.

- **Access:** `communications.read` / `.manage` / `.import` (Nonnis Admin +
  Operations only; provider/discharge users denied).
- **Contacts:** `CommunicationContact` (email + normalized email, phone +
  E.164, organization, MANUAL/PASTE/CSV/TXT source, ACTIVE/ARCHIVED). At least one
  usable channel is required; archiving (never hard delete) preserves future
  history. Duplicate detection on normalized email/phone; an email matching one
  contact and a phone matching a **different** contact is a CONFLICT that is never
  auto-merged.
- **Consent is channel-specific** (`ContactChannelPreference`): UNKNOWN / OPTED_IN
  / OPTED_OUT per EMAIL and SMS. **Imports default to UNKNOWN** — uploading an
  address never implies consent. `CommunicationSuppression` is a central,
  authoritative, upsert-based opt-out/bounce list; import never clears it.
- **Imports:** a polished paste / CSV (with column mapping) / TXT wizard —
  **parse → validate → preview → confirm → commit**. Preview never mutates; commit
  **re-validates server-side**. Bounded to 5 MB / 25,000 rows; raw files are never
  stored; a downloadable, formula-injection-safe error CSV lists rejected rows.
  Imported contacts can optionally join a list and receive tags.
- **Normalization:** `libphonenumber-js` E.164 (explicit default country);
  class-validator email **format** validation (clearly not mailbox verification).
- **Provider-independent transports:** `EmailTransport` / `SmsTransport` ports
  injected by DI token, with deterministic **mock** implementations. The provider is
  chosen by `COMMUNICATIONS_EMAIL_PROVIDER` / `COMMUNICATIONS_SMS_PROVIDER` (default
  `mock`); reserved live values fail safely until their phase ships. A reusable
  `evaluateChannelEligibility` policy (OPTED_IN required; UNKNOWN never treated as
  opted-in) is provided for campaign building in 15B/15D.
- **CRM UI:** a **Communications** nav group — Contacts (counts, filters, create/
  edit/consent/archive, detail), Lists (create + member management), Imports (the
  wizard) — in the Warm Premium design language with confirm/toast/`MutationButton`.
  No campaign/inbox pages yet.
- **Demo data:** `npm run seed:communications-demo` (idempotent; `-- --clean`
  removes it) seeds ~16 clearly-fictional contacts (no PHI) covering email-only,
  phone-only, both, varied consent, and suppressed cases — plus (15B) two demo email
  templates and one **draft** campaign (never queued or sent).

## Communications — Email Templates & Campaigns (Phase 15B)

Outbound email built on the 15A foundation. Adds `communications.send` (Nonnis Admin
+ Operations), which gates **all** campaign queueing and test sends.

- **Templates + visual builder:** reusable templates with a block builder (text /
  heading / image / button / columns / divider / spacer). The **backend MJML compiler
  is authoritative** over the HTML — the frontend never sends trusted HTML, and the
  live preview calls the same server compiler. **Merge fields are allow-listed**
  (`firstName`, `lastName`, `fullName`, `email`, `organizationName`, system
  `unsubscribeUrl`) and **exclude all patient/case/clinical/PHI fields**; values are
  HTML-escaped per recipient.
- **Campaigns:** a Details → Template → Audience → Review wizard with a recipient
  **eligibility preview**. The **sender is fixed** to the configured verified sender
  (only From-Name is editable). Queueing snapshots content + recipients and returns
  immediately — it never sends inline.
- **Delivery:** a **Postgres-backed dispatcher** claims recipients with `FOR UPDATE
  SKIP LOCKED` (multi-instance safe), sends with bounded concurrency, and retries
  transient failures with backoff. The 15A eligibility + suppression policy is
  re-checked **at send time** (a newly opted-out contact is not sent). Ambiguous
  sends become `DELIVERY_UNKNOWN` and are **never blindly retried**. Campaigns can be
  **cancelled** (stops not-yet-sent recipients).
- **Provider:** a real **Brevo** adapter behind the 15A `EmailTransport` port.
  `COMMUNICATIONS_EMAIL_PROVIDER=mock` stays the default and needs no keys; selecting
  `brevo` without a key **fails at startup** (never silently mocks). The API key is
  never exposed through an API, logged, or committed.
- **Events & unsubscribe:** a **secret-guarded** delivery-event webhook drives
  bounce/complaint/unsubscribe → suppression idempotently; a **public opaque-token
  unsubscribe** page (no id/email in the URL) plus one-click `List-Unsubscribe`
  headers on every send.
- **CRM UI:** **Email Templates** (builder + preview + test send) and **Email
  Campaigns** (wizard + detail page with count cards, filterable recipient table, and
  live status polling). A mock-mode banner shows when no live provider is configured.

Future phases: 15C (email inbox + replies), 15D (SMS + two-way), 15E (unified inbox +
hardening). Full details in [`docs/COMMUNICATIONS.md`](docs/COMMUNICATIONS.md).

## Relationship to the existing website

The public marketing site at the repository root keeps its existing behavior; the
changes are additive — the form-submission persistence call, plus a new `/blog` area,
a homepage testimonials band, and a "Blog" nav link, all reading published content from
the platform's public API. Repository-level isolation guards keep tooling from crossing
the boundary: the root `tsconfig.json` and `eslint.config.mjs` exclude `nonnis-platform`,
and `.gitignore` ignores its build artifacts.
