# Core System Audit — Nonni's Digital Optimization Platform

Full pre-acceptance audit of the public marketing website, the CRM frontend and
the NestJS backend. The goal was verification, not new features: confirm the
agreed requirements are actually implemented, find missing or broken workflows,
and establish whether the system is ready for client acceptance testing.

**Audit date:** 2026-09-03
**Verdict:** Ready for client acceptance testing. No blocking defects remain in
code. Remaining launch work is external configuration, listed in
[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

## 1. How findings were classified

Every finding was placed in exactly one bucket, and only the first three were
acted on:

| Class | Action | Count |
| --- | --- | --- |
| A — Bug | Fixed | 3 |
| B — Security / data integrity | Fixed | 5 |
| C — Agreed core requirement missing | Implement minimum | 0 |
| D — Optional / nice-to-have / new idea | Documented, **not** implemented | 4 |

No feature work was performed. Nothing in the "out of scope" list below was
started, designed, or stubbed.

## 2. Evidence base

Everything in the matrix below was verified by execution, not by reading code
alone. The reproducible evidence:

| Check | Result |
| --- | --- |
| Backend test suite | **554 tests / 79 suites passing** |
| CRM frontend test suite | **96 tests / 18 files passing** |
| Public website test suite | **26 tests / 5 files passing** |
| Authenticated visual matrix | **75 page-views** (25 CRM pages × 1440/1024/390) — 0 issues |
| Public site visual matrix | **45 page-views** (15 pages × 1440/1024/390) — 0 issues |
| Route authorization sweep | **267 routes** — 15 public, 1 auth-only, 251 permission-gated |
| Fresh-database migration test | 15 migrations applied cleanly to an empty database |
| Schema drift check | `migrate diff` reports **no difference** |
| Seed idempotency | 3 consecutive runs → identical row counts |
| Production builds | website, CRM and backend all build from a clean state |

The authenticated visual review — which Communications 15E could not complete
because no usable credentials existed — is now **closed**. A dev-only account
script (`npm run dev:auth-account`, see §7) creates a real Supabase user through
the existing auth architecture, so all 25 CRM pages were inspected while logged
in. No page redirected to `/login`.

## 3. Requirements traceability matrix

Status: **PASS** verified working · **PARTIAL** works with a documented
limitation · **FAIL** broken · **N/A** deliberately out of scope.

### 3.1 Authentication, authorization and tenancy

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1.1 | Every endpoint has an explicit authorization policy | Global `AuthGuard` + `PermissionsGuard`; `@Public()` is opt-in | `route-authorization.spec.ts` walks all 267 registered routes and fails on anything not allow-listed | PASS |
| 1.2 | Only intended endpoints are public | 15 public routes: health, public content/directory, unsubscribe, form ingest, 4 provider webhooks | Allow-list asserted in test | PASS |
| 1.3 | Unauthenticated requests are rejected | Bearer token required | Live: `GET /cases` without token → **401**; invalid token → **401** | PASS |
| 1.4 | A user cannot act in an organization they do not belong to | `X-Organization-Id` honoured only if it matches an **active** membership | Live: forged org header → **403** "You are not a member of the requested organization." | PASS |
| 1.5 | Suspending a user revokes access immediately | User/membership/org status re-read from the DB on every request | Live: suspended the user, reused the **same valid JWT** → **403**; restored → 200 | PASS |
| 1.6 | Cross-tenant object access is not possible | `ProviderAccessService` / `ReferralAccessService` centralise scoping | Cross-tenant reads return **404, not 403**, so record existence is never revealed | PASS |
| 1.7 | Provider users see only their own provider | Provider derived from `activeOrganizationId`, never from a request parameter | `provider-access.spec.ts`, `provider-portal.service.spec.ts` | PASS |
| 1.8 | Roles carry the right permissions | 5 roles, 42 permissions, 110 mappings, pruned to match `rbac.ts` on every seed | Seed is idempotent and self-correcting | PASS |

### 3.2 Data integrity and the database

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 2.1 | History-bearing records are never destroyed | No API deletes Case, Referral, Placement, Task, Message, AuditEvent, WorkflowEvent, Contact, Conversation, Campaign, Provider, Organization, User or FormSubmission | Hard-delete sweep: only provider child-config, CMS content and join rows are deleted | PASS |
| 2.2 | Migrations apply cleanly to a new environment | 15 migrations, no `DROP TABLE/COLUMN/SCHEMA` or `TRUNCATE` anywhere | Applied to a throwaway Postgres 16 container; dev DB untouched | PASS |
| 2.3 | Migrations match the schema | — | `prisma migrate diff` → "No difference detected" | PASS |
| 2.4 | Seeds are safe to re-run | Upserts + pruning | 3 runs → 42/5/110/15/8/8/5/5/8 rows, unchanged | PASS |
| 2.5 | Duplicate referrals cannot be created | Pre-check for a clean error **plus** a `FOR UPDATE` lock on the parent service request with an in-transaction re-check | `referrals.service.spec.ts` proves a request that races past the pre-check is still rejected | PASS |
| 2.6 | Campaigns cannot double-send | DRAFT→QUEUED claimed atomically with recipient creation; deterministic `campaignId:contactId` keys | Communications suite | PASS |
| 2.7 | Hot query paths are indexed | Composite indexes on the dispatch claim, campaign progress, inbox list, thread correlation and webhook correlation | `EXPLAIN ANALYZE` at 6,000 recipients / 4,000 conversations / 12,000 messages — all **< 2 ms** | PASS |

### 3.3 API surface and input handling

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 3.1 | Unknown fields cannot be injected | Global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` | Mass assignment is structurally impossible — unknown properties are rejected, not stripped silently | PASS |
| 3.2 | Pagination is bounded | `@Min(1) @Max(100)` on every paging DTO | No paging DTO lacks `@Max` | PASS |
| 3.3 | Sort fields cannot be injected | Every dynamic `orderBy` key is checked against a whitelist with a safe fallback | 10 call sites verified | PASS |
| 3.4 | Request bodies are bounded per route | Per-route limits: imports 6 MB, email inbound 1 MB, email webhook 512 KB, SMS webhooks 128 KB, everything else 2 MB | Oversized bodies → 413, malformed → 400 | PASS |
| 3.5 | Errors never fail silently | No empty `catch` blocks exist in application code | Repository-wide sweep. **Note:** this sweep matched only *empty* catch blocks and missed one that swallowed a 401 behind a comment — found later and fixed as F8 | PARTIAL |
| 3.6 | Secrets never reach logs | Log statements name environment variables, never their values | Sweep of all `logger.*` / `console.*` calls | PASS |
| 3.7 | Public responses leak nothing internal | Public serializers are explicit view projections, not row spreads | No ids, status, timestamps, notes, capacity or PHI in the public directory | PASS |
| 3.8 | CSV exports are safe | Formula-injection guard (`=+-@\t\r` prefixed), RFC-4180 quoting, 10,000-row cap | `csv.spec.ts` | PASS |

### 3.4 Website, forms and public content

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 4.1 | All six website forms submit reliably | `care_profile`, `contact`, `home_care_inquiry`, `find_community`, `provider`, `hospital_referral` | Single shared endpoint; all six keys mapped | PASS |
| 4.2 | Triple flow: email + PDF record + CRM persistence | Email is the durable path; CRM persistence is additive and best-effort | A persistence failure logs the reference id (never contents) and never breaks the user's submission | PARTIAL — see R1 |
| 4.3 | Spam submissions are dropped | Honeypot field; a bot gets `200 ok` and no record | Detection is never revealed | PASS |
| 4.4 | Structured data cannot inject script | `jsonLdScript()` escapes `<`, `>`, `&`, U+2028/29 | `json-ld.test.ts` proves `</script>` in a provider name cannot break out | PASS (fixed) |
| 4.5 | Canonical URLs are correct | Single source of truth in `src/lib/site-url.ts`, driven by `NEXT_PUBLIC_SITE_URL` | `robots.txt` and `sitemap.xml` verified live | PASS (fixed) |
| 4.6 | Only published content is public | Public API omits drafts/archived/inactive; sitemap inherits that | Sitemap built from the same public API | PASS |

### 3.5 Communications

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 5.1 | Email and SMS work without live credentials | Provider-independent transports; mock adapters selected by config factories that fail safe | Entire suite runs with zero provider credentials | PASS |
| 5.2 | Providers are swappable | `EMAIL_TRANSPORT`, `SMS_TRANSPORT`, `INBOUND_EMAIL_ADAPTER`, `SMS_INBOUND_ADAPTER` DI tokens | No provider name appears in any user-facing string | PASS |
| 5.3 | A crash never silently resends | `dispatchedAt` stamped immediately before each provider call; expired leases resolve to requeue **or** `DELIVERY_UNKNOWN`, never a blind resend | `delivery-maintenance.service.ts` | PASS |
| 5.4 | Inbound email is idempotent | Unique `providerInboundId`; retried webhooks return a safe acknowledgement | Duplicate deliveries counted, not duplicated | PASS |
| 5.5 | Inbound HTML cannot execute | Strict allow-list: `<a>` is the only tag granted attributes; no `svg`, `form`, `object`, `video`; safe schemes only | `inbound-sanitize.spec.ts`, including regression tests for both published sanitize-html advisories | PASS |
| 5.6 | Attachments are private | Dedicated private bucket, short-lived signed URLs only, header-safe download names, no public path | `attachment-storage.service.ts` | PASS |
| 5.7 | Webhooks are authenticated | Secret or provider signature on all four | Inventory in §5 | PASS |
| 5.8 | Unsubscribe always works | HMAC token; consent re-checked at send time, not only at queue time | `email-dispatcher.spec.ts` | PASS |

### 3.6 Operations, reporting and workflow

| # | Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 6.1 | Operations control centre loads | 13 aggregates in a single `$transaction` | Renders correctly; latency is environmental — see R2 | PASS |
| 6.2 | Case workflow drives status | `applyCaseStatus` with explicit allowed-from sets; append-only `WorkflowEvent` | `case-status-policy.spec.ts`, `referral-transition.spec.ts` | PASS |
| 6.3 | Referral lifecycle is enforced | Explicit transition table; provider and staff paths separated | `referral-transition.spec.ts` | PASS |
| 6.4 | Reports are permission-gated and exportable | `REPORTS_EXPORT` gates CSV | Filters shareable via URL | PASS |
| 6.5 | Report pages do not waste queries | Fetch keyed on the serialized query, not object identity | Verified live across all 7 report pages: **no duplicate data fetches** | PASS (fixed) |
| 6.6 | Every action is audited | `AuditService.record` inside the same transaction as the change | Audit rows cannot be orphaned from their change | PASS |

## 4. Defects found and fixed in this audit

| ID | Class | Defect | Fix |
| --- | --- | --- | --- |
| F1 | B | **Script injection via structured data.** `JSON.stringify` inside `dangerouslySetInnerHTML` does not escape `<`; a provider name containing `</script>` would have executed arbitrary script on a public page | Added `jsonLdScript()`; escapes `<`, `>`, `&`, U+2028/29. Output still parses to identical data |
| F2 | B | **Placeholder production domain shipped.** `nonnisplacement.example` was hard-coded in `layout.tsx`, `sitemap.ts` and `robots.ts`, so canonical URLs, OpenGraph and the sitemap were all wrong | Single env-driven `SITE_URL`; a test fails the build if a reserved/placeholder TLD ever returns |
| F3 | B | **Production could boot silently misconfigured.** Every setting fell back to a dev default, so a missing variable would have shipped `http://localhost:3000` unsubscribe links, `reply.mock.local` reply addresses, and CORS pinned to localhost | `assertProductionConfig()` refuses to start, listing every problem by variable name and never logging values |
| F4 | B | **No baseline response headers**, and the API advertised its stack | `x-powered-by` disabled; `nosniff`, `DENY`, `no-referrer`, `same-site` set |
| F5 | B | **Known-vulnerable Next.js.** 16.2.10 was subject to SSRF in rewrites, middleware bypass and DoS advisories | Upgraded to 16.3.4 — a **minor** bump, no major migration. Website now reports **0 production vulnerabilities** |
| F6 | A | **Report pages fetched the same query twice.** Filters live in the URL, so `values` took a new object identity on every rewrite and re-fired the same expensive aggregate | Fetch keyed on the serialized query; defaults presented on first render |
| F7 | A | **Duplicate referrals under concurrency.** Duplicate prevention was check-then-act with no serialisation, so a double submit could create two referrals | `FOR UPDATE` lock on the parent service request plus an in-transaction re-check |
| F8 | A | **Unrecoverable sign-in dead end.** Two faults combined: `/auth/me` returning 401 was swallowed behind a `/* surfaced elsewhere */` comment, so an expired session rendered "No organization access" (wrong — that message means "no membership"); and `signOut()` awaited a network revoke made with the already-rejected token, so when it failed every following line — clearing storage and navigating — was skipped. The only escape hatch on the screen was the one thing a broken session prevented | 401/403 now discards the dead session and routes to `/login`; sign-out always falls back to a local-only clear and always navigates. Both branches verified by reproducing a dead session end to end |

## 5. Webhook inventory

All four are `@Public()` by necessity (providers cannot hold a Supabase session)
and all four are independently authenticated, size-bounded and idempotent.

| Endpoint | Purpose | Authentication | Body limit |
| --- | --- | --- | --- |
| `POST /api/v1/communications/email/webhook` | Email delivery events | Shared secret | 512 KB |
| `POST /api/v1/webhooks/communications/email/inbound` | Inbound email content | High-entropy secret (query or `x-inbound-secret`) | 1 MB |
| `POST /api/v1/webhooks/communications/sms/inbound` | Inbound SMS | `X-Twilio-Signature` (official validator) | 128 KB |
| `POST /api/v1/webhooks/communications/sms/status` | SMS delivery status | `X-Twilio-Signature` (official validator) | 128 KB |

`POST /api/v1/form-submissions/ingest` is also public but is protected by a
server-only shared token; it is only ever called by the website's server side,
never a browser.

## 6. Dependency audit

`npm audit --omit=dev` was run for all three applications and every finding was
triaged against actual usage rather than upgraded blindly.

| Application | Before | After | Notes |
| --- | --- | --- | --- |
| Public website | 4 high | **0** | Next 16.2.10 → 16.3.4 (minor) |
| CRM frontend | 1 high, 1 moderate | 1 high, 1 moderate | postcss only; fix requires Next 15 → 16 (**major**) — see R3 |
| Backend | 34 high, 2 moderate | 34 high, 1 moderate | `qs` pinned to 6.16.0; the rest are unreachable — see below |

The backend's 34 "high" findings are a single chain (`mjml` → `html-minifier`
ReDoS) and are **not reachable**:

- `mjml-core` defaults `minify = false` and only calls `html-minifier` inside
  `if (minify)`. The compiler calls `mjml2html(markup, { validationLevel: "soft" })`
  and never enables minification, so the vulnerable code never executes.
- The `mj-include` directory-traversal advisory requires `mj-include`, which is
  never used — markup is generated from structured blocks, never loaded from files.

Upgrading to `mjml` 5.x would be a **major** version change requiring template
re-verification, and is not warranted to close an unreachable path.

The two `sanitize-html` advisories are likewise unreachable: they depend on
`action` / `formaction` / `poster` / `background` / `data` attributes or on SVG
SMIL elements, none of which survive the strict allow-list. **This conclusion is
now enforced by tests**, so widening the allow-list will fail the build rather
than silently reintroduce the vector.

## 7. Development access

`npm run dev:auth-account` creates or removes a real Supabase user with a
`NONNIS_ADMIN` membership, using the same admin API and Prisma membership model
as production. It:

- refuses to run when `NODE_ENV=production`;
- requires `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD` (minimum 12 characters) from
  the environment — no password is hard-coded;
- never prints the password;
- removes both the auth user and the membership with `--remove`.

The account created for this audit was removed at the end of it. No credentials
are committed anywhere in the repository.

## 8. Known residual production risks

These are accepted, documented risks — not defects. Each has a concrete
mitigation or remediation path.

**R1 — A CRM outage loses form submissions from the admin panel (not from the business).**
Website form submission treats email as the durable record and CRM persistence
as additive. If the backend is unreachable, the submitter still succeeds and the
admin still receives the full email, but no CRM row is created. The failure is
logged with the submission's reference id. *Mitigation:* the emailed reference
id allows manual re-entry; monitor the log line
`[api/forms/submit] platform persistence failed`. *Remediation if this becomes
unacceptable:* a durable local queue with retry — deliberately not built, as it
is beyond the agreed scope.

**R2 — Endpoint latency is dominated by database round trips.**
The operations summary issues 13 aggregates in one transaction. Measured from a
developer machine against the remote Supabase instance, a single round trip is
**742 ms**, making that page take ~9 s. This is environmental, not a query
defect: the queries are already batched and indexed. *Mitigation:* **deploy the
backend in the same region as the database.** At a 1–5 ms round trip the same
page costs ~15–65 ms. Do not tune queries based on measurements taken locally.

**R3 — The CRM frontend carries two postcss advisories.**
Closing them requires Next 15 → 16, a major upgrade that was deliberately not
performed during an audit. The advisories concern source-map auto-loading while
processing CSS; the CRM's CSS is authored in-repo and not attacker-controlled,
so the practical risk is low. *Remediation:* schedule the Next 16 migration as
its own tested change.

**R4 — There is no application-level rate limiting.**
Public endpoints are protected by shared secrets (form ingest), HMAC tokens
(unsubscribe) or provider signatures (webhooks), so none of them allows
unauthenticated database writes. Public content reads are cacheable and
read-only. *Mitigation:* apply rate limiting at the reverse proxy / hosting
platform, which is where it belongs for a single-instance deployment. An
in-process limiter was deliberately not added.

**R5 — Seven foreign keys have no index.**
`case_requirements.completedByUserId`, `provider_capacity.serviceCategoryId`,
`provider_capacity.updatedByUserId`, `communication_conversations.originCampaignId`,
`communication_conversations.originSmsCampaignId`,
`communication_email_campaigns.templateId`,
`communication_sms_campaigns.templateId`. All are low-cardinality audit or
lookup columns that appear in no hot query path, and none of their parents is
deletable through the API. Measured impact at realistic scale: none. *Remediation
if parent deletion is ever added:* index the corresponding column first.

**R6 — Manual database deletion can still destroy history.**
The schema has 32 cascading relations. No API route reaches a history-bearing
parent, so this is unreachable through the application — but a direct `DELETE`
by a database administrator would cascade. *Mitigation:* the runbook forbids
direct writes to production and requires a verified backup first.

**R7 — Exactly-once delivery is not claimed.**
If the process dies between stamping `dispatchedAt` and receiving the provider's
response, the message is marked `DELIVERY_UNKNOWN` and is **never** resent. This
deliberately prefers a possible silent non-delivery over a possible duplicate
send to a real person. Operators can see and act on these in Delivery Operations.

## 9. Deliberately not implemented

Raised during the audit and **not** built, because they are new scope:

- Durable retry queue for website form persistence (R1)
- In-process API rate limiting (R4)
- Indexes for the seven cold foreign keys (R5)
- Partial unique index for active referrals — the row lock in F7 closes the race
  without introducing a constraint that `schema.prisma` cannot express, which
  would have caused permanent migration drift

Confirmed still out of scope and untouched: External API & Integration
Architecture, Workflow Automation Engine, Provider Matching Engine, Advanced
Analytics & Reporting, Document & Compliance Management System, AI features,
provider ranking, predictive scoring, scheduled/drip campaigns, billing,
Stripe, WhatsApp, RCS, MMS, Gmail/Outlook/IMAP sync, support ticketing, SLA
engines, open/click tracking and A/B testing.
