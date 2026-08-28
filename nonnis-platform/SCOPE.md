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

---

## 6. Remaining implementation sequence

```
COMPLETED
  1. Platform Foundation
  2. Identity / Authentication / Authorization / Organizations / RBAC
  3. Discharge Professional Dashboard & Case Workspace
  4. Scope Realignment & Architecture Cleanup
  5. Provider Management + Service Categories + Capacity
  6. Basic Provider Portal   ← current slice

NEXT
  7.  Nonnis Admin Operations Control Center

REMAINING
  8.  Referral Workflow with Manual Provider Selection
  9.  Tasks + Basic Case Messaging + Unified Timeline
  10. Discharge Readiness Score + Operational Blockers
  11. Basic Reporting + Administrative Reports
  12. Public Residential Provider Directory
  13. Website Form Submissions -> Admin Panel + Existing Email Flow (additive)
  14. Full Core-System Audit + Production Hardening
```

> Slice 13 (Website Form Submissions) is additive: the existing public-website
> email delivery and document/report output must keep working; platform
> persistence is added alongside so admin staff can view submissions internally.

There are **no** future slices for the Matching Engine, Automation Engine,
Document/Compliance System, Advanced Analytics, or External Integration
Architecture. They are out of scope unless the client explicitly expands it.

---

## 7. Next recommended implementation step

**Nonnis Admin Operations Control Center** (item 7): a Nonnis-staff operations
surface to oversee cases and providers across organizations — cross-org case
visibility (via `cases.read_all`), provider oversight, and manual operational
intervention. Basic operational dashboards/counts only — no automation, matching,
advanced analytics, or referral workflow (referrals come in item 8).
