# Administrative Reporting

Basic, deterministic reporting over **current** platform data for Nonnis staff.
This is **not** advanced analytics — there is no warehouse, event pipeline, trend
engine, comparison/percentage-change, scoring, ranking, prediction, matching,
scheduling, emailing, background worker, or custom report builder. Reports answer
straightforward questions: how many, what status, which organization/facility.

## 1. Access & permissions

Two permissions (in `src/common/rbac.ts`, seeded idempotently — no migration):

| Permission       | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| `reports.read`   | Read reports (counts, groupings, filtered lists).  |
| `reports.export` | Export the filtered report as CSV.                 |

Granted **only** to `NONNIS_ADMIN` and `NONNIS_OPERATIONS`. Discharge
professionals and provider users get neither. Enforcement is on the backend
`PermissionsGuard` (`@RequirePermissions`), not merely by hiding the nav item.

Reporting is intentionally **cross-organization** for authorized Nonnis staff.
The reporting queries live entirely inside the reports services; ordinary
tenant-scoped Cases/Providers/etc. APIs are **not** globally unscoped.

## 2. Backend module

`src/modules/reports/`:

```
reports.controller.ts          # routes (reports.read for data, reports.export for CSV)
reports.module.ts
report-shared.ts               # date-range parsing, humanizeEnum, pagination helpers, response type
report-lookups.service.ts      # batch name resolution for raw-UUID columns (no N+1)
report-readiness.ts            # readiness-level / blocker-type WHERE fragments (compose readiness-query only)
csv.ts                         # sanitizeCsvCell, toCsv, csvFilename, MAX_EXPORT_ROWS
dto/report-filters.dto.ts      # validated per-report query DTOs
services/
  overview.service.ts
  report-options.service.ts    # filter dropdown option lists
  cases-report.service.ts
  referrals-report.service.ts
  providers-report.service.ts
  readiness-report.service.ts
  tasks-report.service.ts
  form-submissions-report.service.ts
```

Endpoints (all under `/api/v1/reports`):

| Method & path                         | Permission       |
| ------------------------------------- | ---------------- |
| `GET /overview`                       | `reports.read`   |
| `GET /filter-options`                 | `reports.read`   |
| `GET /cases`                          | `reports.read`   |
| `GET /referrals`                      | `reports.read`   |
| `GET /providers`                      | `reports.read`   |
| `GET /readiness`                      | `reports.read`   |
| `GET /tasks`                          | `reports.read`   |
| `GET /form-submissions`               | `reports.read`   |
| `GET /<dataset>/export`               | `reports.export` |

## 3. Response contract

Every list report returns a typed envelope (wrapped by the global `{ data }`
interceptor):

```jsonc
{
  "appliedFilters": { ... },   // echo of the normalized filters (for print/debug)
  "generatedAt": "ISO",
  "summary": { ... },          // counts only — no trends/deltas
  "groups": { ... },           // simple grouped counts, e.g. byStatus/byOrganization
  "items": [ ... ],            // one page of minimum-necessary rows
  "page": 1, "pageSize": 20, "total": 0, "totalPages": 0
}
```

Raw Prisma entities are never returned; each service maps to a safe row shape.

## 4. Global filter model

Core filters shared by every report (all backend-validated in the DTOs):

- `dateFrom`, `dateTo` — `YYYY-MM-DD`, interpreted in **UTC**; `dateFrom` is
  inclusive from 00:00:00Z, `dateTo` inclusive through the end of that day.
- `organizationId`, `facilityId` — UUIDs. Facility options react to the selected
  organization in the UI.

Each report adds its own filters (status, readiness level, capacity, overdue,
etc.), plus `search`, `page`, `pageSize` (max 100), whitelisted `sort`, `order`.

Default period in the UI is the **last 30 days** — written into the URL so it is
visible, shareable, and clearable. The backend applies **no** default range
(absent bounds = all time), so clearing truly clears.

## 5. Date semantics (documented, never silently mixed)

| Report            | Primary date range applies to                              |
| ----------------- | ---------------------------------------------------------- |
| Cases             | `Case.createdAt`                                           |
| Referrals         | `Referral.sentAt` (drafts, when included, match `createdAt`) |
| Tasks             | `Task.createdAt`                                           |
| Form submissions  | `WebsiteFormSubmission.submittedAt`                        |
| Readiness         | current snapshot; optional `expectedDischargeDate` range   |
| Providers         | current directory snapshot (no date range)                 |

## 6. Reused business definitions (no duplication)

- **Active cases / statuses:** `modules/cases/case-query.ts`
  (`ACTIVE_STATUSES`, `NON_TERMINAL_STATUSES`).
- **Readiness:** the deterministic domain `computeReadiness` is the single source
  of truth. For each **displayed** row the report loads `readinessCaseInclude` and
  maps through `toReadinessView` — bounded to the page (≤ pageSize), so no N+1 and
  no full readiness run over the whole table. Summary/level/blocker **counts** use
  the shared `readiness-query` WHERE fragments (the same approximations the
  Operations surfaces use).
- **Referral overdue:** `modules/referrals/referral-overdue.ts`
  (`referralOverdueWhere`) — shared by the referral queues and this report.
- **Tasks overdue:** `dueAt < now && status ∈ {OPEN, IN_PROGRESS}`.
- Enums (`CaseStatus`, `ReferralStatus`, `TaskStatus/Priority`, `ProviderStatus`,
  `CapacityStatus`, `FormSubmissionStatus`) come straight from Prisma.

## 7. Minimum-necessary data

Rows and exports never include: patient clinical detail, Nonnis internal notes,
message bodies, referral/task free-text notes, `AuditEvent` metadata, or the
`WebsiteFormSubmission.submittedData` JSON. Full detail stays in the existing
screens; rows link to them (Case workspace, provider detail, form-submission
review).

## 8. CSV export

- `GET /api/v1/reports/<dataset>/export` (`reports.export`) uses the **same**
  filters as the on-screen report.
- **Formula-injection safe:** `sanitizeCsvCell` prefixes any value beginning with
  `= + - @` (or a tab/CR lead) with a `'` so spreadsheets can't execute it, then
  applies RFC-4180 quoting. Output is UTF-8 with a BOM.
- **Row cap:** `MAX_EXPORT_ROWS = 10,000`. A larger filtered set returns `422`
  asking the user to narrow filters — no background export queue.
- **Filename:** `nonnis-<type>-YYYY-MM-DD.csv`. `Content-Disposition` is
  CORS-exposed (`exposedHeaders`) so the browser keeps the dated name.
- **Audit:** each export writes a `report.exported` `AuditEvent` — actor, report
  type, safe filter summary, row count. The exported **rows are never stored**.
- Export is not destructive → no confirmation dialog; success/failure surfaces via
  the shared toast system.

## 9. Frontend

`src/features/reports/`: a reusable `ReportView` drives every dataset page
(`CasesReport`, `ReferralsReport`, `ProvidersReport`, `ReadinessReport`,
`TasksReport`, `FormSubmissionsReport`) plus a `ReportsOverview` hub. Routes:
`/reports` and `/reports/{cases,referrals,providers,readiness,tasks,form-submissions}`.

- Filter state lives in the URL (`useReportQueryState`) — refresh- and link-safe;
  any filter change resets the page.
- Warm Premium design system throughout: `PageHeading`, `Panel`, `DataTable`,
  `StatusBadge`, summary metric cards (counts only), grouped-count tables,
  `LoadingState` / `EmptyState` / `ErrorState`, compact filter bar with
  active-filter chips + **Reset filters**.
- Data fetching via `useAsync` (stale-response safe). CSV export uses
  `MutationButton` + toast; a **Print** button calls `window.print()`.

## 10. Print

Print CSS (in `globals.css`) hides the sidebar, top bar, filter bar, and action
buttons, and prints only the `#report-print` surface in neutral ink. A
**print-only** context block shows the report title, generated timestamp, and the
applied period so a paper copy is understandable later.

## 11. Performance

Counts/groupings use Prisma `count` / `groupBy` (not row loading + JS counting).
Detail rows batch their relationships (`include` / `_count`) and resolve raw-UUID
columns (task assignees, form reviewers, grouped org/facility keys) with a single
batched lookup — no per-row queries. Existing indexes on the common filter columns
(`Case.createdAt/status/organizationId/...`, `Referral.status`, `Task.status/…`,
`WebsiteFormSubmission.submittedAt/status/formKey`, provider `status/state/city`)
cover the report filters, so **no schema/index migration was required**.

## 12. Anti-scope

No warehouse, ETL, event ingestion, scheduled/materialized aggregation, or
background workers. No trend/percentage-change, cohort, prediction, provider or
facility performance scorecard, staff productivity metric, provider ranking, or
matching. No configurable/scheduled/emailed reports and no custom report builder.
Fixed, standard administrative reports only.
