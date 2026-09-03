# Production Runbook — Nonni's Digital Optimization Platform

Operating guide for the deployed system. **This document contains no secret
values and none may ever be added to it** — only variable names.

## 1. What is deployed

Three independently deployable applications plus one managed database:

| Component | Stack | Talks to |
| --- | --- | --- |
| Public marketing website | Next.js | Backend (server-side only), SMTP |
| CRM frontend | Next.js | Backend (browser), Supabase Auth |
| Backend API | NestJS, prefix `api/v1` | Postgres, Supabase Auth/Storage, email + SMS providers |
| Database | Supabase Postgres | — |

The website never calls the backend from the browser, so CORS does not apply to
it. The CRM does, and the backend allows **exactly one** origin: `FRONTEND_URL`.

> **Deploy the backend in the same region as the database.** Endpoint cost is
> dominated by round trips, not query complexity — see risk R2 in
> [CORE_SYSTEM_AUDIT.md](./CORE_SYSTEM_AUDIT.md). A cross-region deployment will
> make dashboards feel broken while every query is individually fast.

## 2. Configuration

At boot the backend checks its production configuration and logs an error block
naming every problem by variable name — never a value. It then **starts anyway**,
so one mistyped variable degrades the feature it affects instead of taking down
health checks, public content and sign-in along with it.

Search the deploy logs for `production configuration problem(s) detected` after
every deployment. The listed variables are genuinely broken and must be fixed;
the process starting is not a sign that they are optional.

Set `STRICT_CONFIG_CHECK=true` to make the same check refuse to start instead.
Use it in staging or a pre-release smoke test, where failing loudly is safe —
not in the live environment.

### Backend — required in production

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Must be `production` to enable the startup check |
| `PORT` | Listen port |
| `DATABASE_URL` | Pooled connection (pgbouncer) used for runtime queries |
| `DIRECT_URL` | Direct/session connection used for migrations only |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth and private storage. The service-role key is backend-only and must never reach a browser |
| `FRONTEND_URL` | The CRM origin. Also the **only** allowed CORS origin |
| `COMMUNICATIONS_PUBLIC_SITE_URL` | Public website origin. Unsubscribe links are built from this |
| `COMMUNICATIONS_API_URL` | Public backend origin used in generated links |
| `FORM_INGEST_TOKEN` | Shared secret for website→backend form ingestion |
| `COMMUNICATIONS_UNSUBSCRIBE_SECRET` | HMAC key for unsubscribe tokens |

All three URLs must be absolute `https` and must not be localhost. Both secrets
must be at least 16 characters.

### Backend — required only when a live provider is selected

Selected by `COMMUNICATIONS_EMAIL_PROVIDER`, `COMMUNICATIONS_SMS_PROVIDER` and
`COMMUNICATIONS_INBOUND_EMAIL_PROVIDER`. While these are `mock`, no credentials
are needed and nothing is sent to a real recipient.

| Group | Variables |
| --- | --- |
| Outbound email | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `COMMUNICATIONS_WEBHOOK_SECRET` |
| Inbound email | `COMMUNICATIONS_INBOUND_EMAIL_SECRET`, `COMMUNICATIONS_INBOUND_EMAIL_DOMAIN` (must not be a `.local` mock domain) |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_AUTH_TOKEN`, one of `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_PHONE_NUMBER`, `COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL`, `TWILIO_A2P_APPROVED` |

`TWILIO_AUTH_TOKEN` is required even when sending with an API key, because
inbound and status webhook signature validation uses the account token.
`TWILIO_A2P_APPROVED` is an explicit operator acknowledgement of 10DLC
registration — it is **not** verified against Twilio.

### Backend — tuning (safe defaults, change only with reason)

`EMAIL_DISPATCH_ENABLED`, `EMAIL_DISPATCH_BATCH_SIZE`, `EMAIL_DISPATCH_CONCURRENCY`,
`EMAIL_DISPATCH_POLL_MS`, and the `SMS_DISPATCH_*` equivalents;
`COMMUNICATIONS_INBOUND_MAX_BODY_BYTES`, `COMMUNICATIONS_INBOUND_MAX_ATTACHMENT_BYTES`,
`COMMUNICATIONS_INBOUND_MAX_ATTACHMENTS`, `COMMUNICATIONS_ATTACHMENT_URL_TTL_SECONDS`
(clamped to 60–900 seconds regardless of what is set);
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
for transactional referral mail.

### CRM frontend

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`. All are public by definition — never put a service-role
key or any secret behind a `NEXT_PUBLIC_` name.

### Public website

`NEXT_PUBLIC_SITE_URL` (canonical origin — drives metadata, sitemap, robots),
`NONNIS_PLATFORM_API_URL` (server-only), `NONNIS_INGEST_TOKEN` (server-only),
and `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `FORM_TO`.

## 3. Deploying

Deploy in this order. Each step is safe to stop at.

1. **Back up the database** (§5). Never skip this before a migration.
2. **Apply migrations** with `DIRECT_URL` pointing at the direct connection:
   ```
   cd nonnis-platform/backend
   npx prisma migrate deploy
   ```
   `migrate deploy` only applies pending migrations. It never resets, never
   drops, and never prompts.
3. **Seed reference data** — safe to run on every deploy:
   ```
   npx prisma db seed
   ```
   This upserts roles, permissions and role→permission mappings and prunes
   stale mappings so the database matches `src/common/rbac.ts`. It is idempotent
   and was verified over three consecutive runs.
4. **Deploy the backend.** It will refuse to start on unsafe configuration.
5. **Verify health:** `GET /health` → `{"status":"ok",...}`. Note `/health` is
   deliberately unprefixed (not under `api/v1`) for infrastructure checks.
6. **Deploy the CRM frontend and the public website.**
7. **Run the smoke tests** in [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

### Rolling back

Roll back application containers to the previous image. **Do not roll migrations
back with a down-migration** — none are generated, and reversing a schema change
against live data risks loss. If a migration must be undone, restore from the
backup taken in step 1.

## 4. Never do these on a live database

- `prisma migrate reset` — drops everything
- `prisma db push` — bypasses the migration history
- Anything with `--accept-data-loss`
- `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`
- Direct `DELETE` on `cases`, `referrals`, `placements`, `organizations`,
  `users`, `providers` or any `communication_*` table. The schema has 32
  cascading relations; the application never reaches these parents, but a manual
  delete will cascade and destroy history irreversibly (risk R6).

If a record must be removed, use the application, which soft-deletes or
status-changes rather than destroying history.

## 5. Backup and recovery

**Backups** are provided by Supabase (automated daily snapshots plus
point-in-time recovery on paid plans). Confirm both are enabled and note the
retention window before launch.

**Take a manual backup before every migration:**
```
pg_dump "$DIRECT_URL" --no-owner --no-privileges --format=custom --file=nonnis-<UTC timestamp>.dump
```
Store it outside the database host. It contains PHI — treat it as such.

**Restore drill** (run against a scratch database, never production):
```
createdb nonnis_restore_test
pg_restore --dbname="postgresql://.../nonnis_restore_test" --no-owner nonnis-<timestamp>.dump
```
Then point a backend at it with `NODE_ENV=development` and confirm login,
case list and the operations summary render. **Perform this drill at least once
before go-live** — an untested backup is not a backup.

**Storage** buckets (`nonnis-communications-private`, CMS media) are not covered
by database backups. Enable Supabase Storage backups separately.

## 6. Monitoring

| Signal | Where | Healthy |
| --- | --- | --- |
| API liveness | `GET /health` | `status: ok` |
| Communications readiness | `GET /api/v1/communications/health` | Reports queue depth and provider state |
| Provider configuration | `GET /api/v1/communications/configuration` | `MOCK`, `LIVE_READY` or `INCOMPLETE` — never returns secrets |
| Delivery backlog | Delivery Operations page | Queue not growing; few `DELIVERY_UNKNOWN` |
| Form ingestion failures | Website logs | Absence of `[api/forms/submit] platform persistence failed` |

Alert on: `/health` failing, a growing dispatch queue, a sustained rise in
`FAILED` or `DELIVERY_UNKNOWN`, and any occurrence of the form-persistence log
line.

## 7. Common incidents

**Deploy logs show `production configuration problem(s) detected`.**
Configuration is unsafe. Each line names one variable. Fix them: the affected
features are misbehaving right now — typically localhost unsubscribe links or a
CORS origin that blocks the CRM. The application starting does not mean the
problem is cosmetic.

**Every route returns 500, including `/health` and public endpoints.**
That is a boot failure, not a route problem — the whole function died on start.
Check the deploy logs for the first error after the process launched. Common
causes are an unreachable database, a missing runtime dependency, or (if
`STRICT_CONFIG_CHECK=true` is set) a configuration problem. Do not debug
individual endpoints; nothing is running.

**CRM loads but every API call fails with a CORS error.**
`FRONTEND_URL` does not exactly match the CRM's origin. It allows one origin,
scheme and port included.

**Messages stuck in `QUEUED`.**
Check `EMAIL_DISPATCH_ENABLED` / `SMS_DISPATCH_ENABLED`. Then check provider
configuration via the configuration endpoint. Leases from a crashed process are
recovered automatically: never-dispatched work is requeued, possibly-dispatched
work becomes `DELIVERY_UNKNOWN`.

**Messages in `DELIVERY_UNKNOWN`.**
The process died between calling the provider and recording the response. The
system will **not** resend, to avoid duplicate messages to real people (risk
R7). Confirm in the provider's dashboard and resend manually if genuinely not
delivered.

**Inbound email arriving in "Needs review".**
Expected when a reply cannot be correlated to a thread or contact. Review and
link from the Inbox. A rising rate suggests the reply domain or inbound secret
changed.

**Webhooks returning 401.**
The provider's configured secret or signature no longer matches. Rotate the
secret in both the provider dashboard and the environment together. For Twilio,
the signature is computed over the exact public URL — if the URL changed,
`COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL` must change with it.

**A page is slow.**
Check round-trip latency to the database before optimising any query
(risk R2). Backend and database must be co-located.

## 8. Rotating a secret

1. Generate a new high-entropy value (minimum 16 characters).
2. Update the provider/dashboard side first where one exists.
3. Update the environment variable.
4. Restart the backend and confirm `/health`.
5. Send one test message or webhook and confirm it is accepted.

Rotating `COMMUNICATIONS_UNSUBSCRIBE_SECRET` invalidates every previously issued
unsubscribe link. Rotate it only if it is believed compromised, and be prepared
to explain broken links in already-delivered email.
