# Nonnis Digital Optimization Platform

An internal operations platform for coordinating **post-discharge care**, built as a
**modular monolith** alongside — but fully separate from — the existing public
Nonnis marketing website.

The central business object is the **discharge case**. All architecture is
designed around a case moving through its lifecycle:

```
intake → requirements → provider matching → referrals → provider responses
→ coordination → discharge → service commencement → follow-up → completion
```

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

## Intentionally NOT implemented yet

These are deliberately deferred to later prompts. The architecture does not block
them. Rather than stub ~20 empty modules (placeholder noise), the future backend
module boundaries are documented here and will be added when built:

identity · organizations · facilities · patients · case-requirements ·
service-requests · providers · provider-services · provider-coverage ·
provider-capacity · provider-credentials · matching · referrals · placements ·
tasks · communications · documents · notifications · workflow-automation ·
escalations · outcomes · analytics · integrations

Also deferred: authentication, RBAC/MFA, provider matching engine, referral sending,
provider portal, discharge-professional & operations dashboards, messaging/SMS/email,
document uploads, analytics dashboards, EHR/FHIR/insurance integrations, billing, AI.

`WorkflowEvent.actorRef` and `Case.dischargeProfessionalRef` are nullable string
placeholders that will point at `User` ids once identity/auth is added.

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

## Relationship to the existing website

The public marketing site at the repository root is untouched by this platform. The
only repository-level changes are isolation guards so tooling never crosses the
boundary: the root `tsconfig.json` and `eslint.config.mjs` exclude `nonnis-platform`,
and `.gitignore` ignores its build artifacts.
