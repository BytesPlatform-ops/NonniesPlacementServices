# Website Form Submission Ingestion

How the public Nonni's website (repo root, Next.js 16) forms are **additionally**
persisted into the Nonni's platform admin panel. The existing email + PDF flow is
**unchanged**; persistence is added alongside it.

## Public website: current architecture (audited)

All six public forms submit to a **single** server-side handler:

- **Route:** `src/app/api/forms/submit/route.ts` (`runtime = "nodejs"`).
- **Client helper:** `src/lib/forms/submitForm.ts` POSTs `{ formName, sections, pageUrl, submittedAt, files? }` to `/api/forms/submit` (with a honeypot field).
- **Reference id:** `src/lib/forms/referenceId.ts` → `makeReferenceId()` produces `PREFIX-YYYYMMDD-XXXXXX` (HR / PR / FC / CP / NPS prefixes).
- **Email:** `src/lib/email/sendFormEmail.ts` (nodemailer, Google Workspace SMTP). Recipient `FORM_TO || SMTP_USER`, subject `New <formName> Submission — Nonni's Placement`, `replyTo` = submitter email. The full submission (all `sections`) is emailed.
- **PDF:** `src/lib/pdf/renderSubmissionPdf.ts` (pdfkit) — a branded PDF is generated and attached to every email; uploaded images are previewed inline, other files listed.
- **Uploads:** received as base64 inside the JSON body and attached to the email; **never written to disk**.

### The six forms

| Form | Route (page) | formKey | Uploads | Email | PDF |
|---|---|---|---|---|---|
| Care Profile | `/` (`CareProfileWizard.tsx`) | `care_profile` | none | yes | yes |
| Contact Form | `/contact` (`ContactForm.tsx`) | `contact` | none | yes | yes |
| Home Care Inquiry (Cascadia Home Health) | `/home-health-care` (`HomeCareInquiryForm.tsx`) | `home_care_inquiry` | none | yes | yes |
| Find Community | `/families` (`FindBedForm.tsx`) | `find_community` | none | yes | yes |
| Provider / List Beds | `/providers` (`ListBedsForm.tsx`) | `provider` | **community photos** (base64→email) | yes | yes |
| Hospital Referral | `/hospital-referral` (`HospitalReferralForm.tsx`) | `hospital_referral` | **clinical documents** (base64→email) | yes | yes |

Field lists are defined by each form's zod schema and normalized into `sections`
(`{ title, fields: [{ label, value }] }`) before submission. Only these text
answers are persisted (see below).

## New additive persistence

- **Where:** `src/app/api/forms/submit/route.ts` — after `sendFormEmail(...)` succeeds, the handler calls `persistSubmission(...)` inside an isolated `try/catch`.
- **Helper:** `src/lib/platform/persistSubmission.ts` (`server-only`). It builds a payload from the submission and POSTs it **server-to-server** to the platform.
- **What is sent:** `reference` (the website reference id), `formKey`, `formName`, `sourcePage`, promoted `submitterName/Email/Phone` (derived from `sections`/`replyTo`), `submittedData: { sections }`, `emailStatus: "SENT"`, `reportGenerated: true`, `documentGenerated` (uploads present), `attachmentsCount`, `submittedAt`.
- **What is NEVER sent:** uploaded file bytes (`files[].content`), SMTP credentials, tokens, or any secret. Only normalized text answers + safe metadata.
- **Auth:** the website sends `X-Ingest-Token` = `NONNIS_INGEST_TOKEN` (server-only env). The platform validates it against `FORM_INGEST_TOKEN`. The token is never exposed to the browser.

## Platform: ingestion + admin

- **Ingest endpoint:** `POST /api/v1/form-submissions/ingest` — `@Public` (bypasses user auth) but guarded by `IngestTokenGuard` (shared secret). Idempotent on `reference`: re-ingesting the same reference is a no-op.
- **Model:** `WebsiteFormSubmission` (Prisma) — promoted searchable columns (`reference` unique, `formKey`, `submitterName/Email/Phone`, `status`, `submittedAt`) + full `submittedData` JSON + processing metadata + manual review fields (`status`, `reviewedByUserId`, `reviewedAt`, `internalNotes`) + optional soft links (`relatedCaseId`, `relatedProviderId`). No file bytes.
- **Admin API:** `GET /api/v1/form-submissions` (search / formKey / status / reviewed / date-range / pagination), `GET /:id`, `PATCH /:id` (status, notes, links). Requires `form_submissions.read` / `form_submissions.manage`.
- **Admin UI:** `/operations/form-submissions` — filterable table + detail drawer (summary, contact, grouped form responses, processing metadata, internal review). No raw-JSON-first experience.
- **Access:** `NONNIS_ADMIN` and `NONNIS_OPERATIONS` only. Provider/discharge users have no access. Public users cannot list or fetch submissions.

## Review workflow (manual only)

`NEW → IN_REVIEW → RESOLVED → ARCHIVED` (any transition, manual). Changing status or
notes stamps `reviewedByUserId` + `reviewedAt` and writes an `AuditEvent`
(`form_submission.updated`). No automation, reminders, or escalations. Archiving is
preferred over deletion (there is no hard-delete UI action).

## Failure & duplicate behavior

- **Persistence failure** (platform down, token wrong, timeout — 8s abort) is caught in the website handler, logged with **only the reference id** (never the payload/PII), and does **not** affect the email/PDF flow or the user's success response.
- **Not configured:** if `NONNIS_PLATFORM_API_URL` / `NONNIS_INGEST_TOKEN` are unset, persistence is skipped silently (email still works).
- **Duplicates:** the `reference` is unique and used as the idempotency key — a handler retry with the same reference is ingested once. Client double-submit is already prevented by the forms' submitting state.

## Not built (out of scope)

No document-management system (uploaded files still travel by email only; only
`attachmentsCount` metadata is stored), no automation engine, no external
integration framework, no analytics, no auto-creation of cases/providers/users.

## Could not be live-tested here

SMTP send and the real server-to-server ingest were not exercised end-to-end in this
environment (no safe SMTP recipient; ingest requires both apps running with the
shared token). Verified instead: the website builds with the additive change, the
existing email/PDF code path is untouched, the ingest endpoint + admin API are
unit-tested, and the payload intentionally excludes file bytes and secrets.
