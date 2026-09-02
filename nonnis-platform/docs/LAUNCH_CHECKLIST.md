# Launch Checklist — Nonni's Digital Optimization Platform

Work through this in order. Nothing here is code work: the application is
feature-complete for the agreed scope and all automated checks pass
(see [CORE_SYSTEM_AUDIT.md](./CORE_SYSTEM_AUDIT.md)). What remains is external
configuration, credentials the client must supply, and verification.

**Legend**
`CODE READY` — implemented and tested; needs only configuration.
`EXTERNAL CONFIGURATION PENDING` — blocked on a third party or on a decision
only the client can make.
`DECISION REQUIRED` — someone must choose before launch.

## 1. Blockers — launch cannot proceed until these are resolved

| # | Item | Status | Owner |
| --- | --- | --- | --- |
| 1.1 | **Confirm the exact production domain**, apex vs. `www`. The code reads `NEXT_PUBLIC_SITE_URL` and falls back to `https://nonnisplacement.com`, which is the domain already used by this project's own mail configuration. It has **not** been confirmed as the live web host. Getting this wrong ships wrong canonical URLs, OpenGraph tags and sitemap entries | DECISION REQUIRED | Client |
| 1.2 | DNS for the website, the CRM and the inbound-email reply subdomain | EXTERNAL CONFIGURATION PENDING | Client / hosting |
| 1.3 | TLS certificates valid on every host | EXTERNAL CONFIGURATION PENDING | Hosting |
| 1.4 | Supabase production project created, with automated backups **and** point-in-time recovery enabled | EXTERNAL CONFIGURATION PENDING | Client |
| 1.5 | **Backup restore drill completed** against a scratch database (runbook §5). An untested backup is not a backup | CODE READY — drill not yet run | Ops |
| 1.6 | Generate and set `FORM_INGEST_TOKEN` and `COMMUNICATIONS_UNSUBSCRIBE_SECRET` (16+ characters each) | CODE READY | Ops |
| 1.7 | Set `FRONTEND_URL`, `COMMUNICATIONS_PUBLIC_SITE_URL`, `COMMUNICATIONS_API_URL` to real https origins. The backend refuses to start otherwise | CODE READY | Ops |
| 1.8 | Deploy the backend **in the same region as the database** (audit risk R2) | CODE READY | Ops |

## 2. Live provider credentials

The communications system is **fully implemented and tested end to end against
mock adapters**. No provider credentials exist in this repository and none have
been invented. Until real credentials are supplied, both providers stay in
`mock` mode, which is safe: nothing is sent to a real recipient.

| # | Item | Status |
| --- | --- | --- |
| 2.1 | Brevo account, verified sending domain (SPF/DKIM/DMARC) | EXTERNAL CONFIGURATION PENDING |
| 2.2 | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | EXTERNAL CONFIGURATION PENDING |
| 2.3 | Brevo delivery webhook pointed at `/api/v1/communications/email/webhook` with `COMMUNICATIONS_WEBHOOK_SECRET` | CODE READY |
| 2.4 | Brevo Inbound Parse pointed at `/api/v1/webhooks/communications/email/inbound` with `COMMUNICATIONS_INBOUND_EMAIL_SECRET` | CODE READY |
| 2.5 | Real inbound reply domain set in `COMMUNICATIONS_INBOUND_EMAIL_DOMAIN` (the startup check rejects `.local` mock domains) | EXTERNAL CONFIGURATION PENDING |
| 2.6 | Twilio account, phone number or Messaging Service | EXTERNAL CONFIGURATION PENDING |
| 2.7 | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_AUTH_TOKEN` | EXTERNAL CONFIGURATION PENDING |
| 2.8 | Twilio inbound + status callbacks pointed at `/api/v1/webhooks/communications/sms/{inbound,status}`, with `COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL` matching the public URL exactly | CODE READY |
| 2.9 | **A2P 10DLC registration approved**, then set `TWILIO_A2P_APPROVED`. This flag is an operator acknowledgement and is not verified against Twilio. US carriers filter unregistered traffic | EXTERNAL CONFIGURATION PENDING |
| 2.10 | SMTP credentials for website form email and referral notifications | EXTERNAL CONFIGURATION PENDING |

**Flip to live only after 2.1–2.10**, by setting
`COMMUNICATIONS_EMAIL_PROVIDER`, `COMMUNICATIONS_SMS_PROVIDER` and
`COMMUNICATIONS_INBOUND_EMAIL_PROVIDER` away from `mock`. The startup check will
refuse to boot if a live provider is selected with incomplete credentials, so a
half-configured provider cannot reach production silently.

## 3. Pre-launch verification

Run against the production deployment.

### 3.1 Infrastructure
- [ ] `GET /health` returns `status: ok`
- [ ] `GET /api/v1/communications/configuration` shows the intended readiness state
- [ ] Backend logs show no `Refusing to start`
- [ ] CRM loads and can sign in; no CORS errors in the browser console
- [ ] `https://<domain>/robots.txt` shows the **real** domain in the sitemap line
- [ ] `https://<domain>/sitemap.xml` contains real-domain URLs, real blog posts and real published providers
- [ ] Response headers include `X-Content-Type-Options: nosniff` and no `X-Powered-By`

### 3.2 Staff journey
- [ ] Sign in as a Nonnis admin; the dashboard renders
- [ ] Create a discharge case; it appears in the case list and Operations
- [ ] Create a service request and refer a provider; the referral appears with a reference id
- [ ] Attempt the **same** referral again → rejected as a duplicate
- [ ] Provider responds (accept/decline); case status advances and a timeline entry is written
- [ ] Create and assign a task; it appears for the assignee
- [ ] Post a case message; it appears on the case timeline
- [ ] Open each report, apply a date filter, export CSV; open the CSV in a spreadsheet and confirm no cell is interpreted as a formula

### 3.3 Provider journey
- [ ] Sign in as a provider user; only that provider's referrals are visible
- [ ] Directly request another provider's record by id → **404**
- [ ] Update capacity; the change is reflected for staff

### 3.4 Public journey
- [ ] Every page renders at 1440, 1024 and 390 px with no horizontal scroll
- [ ] Submit **each of the six forms**: care profile, contact, home health care, find community, provider, hospital referral
- [ ] For each: the submitter sees a reference id, the admin inbox receives the full email, and the submission appears in the CRM admin panel
- [ ] Residential directory lists only published, active providers; detail pages load
- [ ] View page source on a provider detail page: the `ld+json` block contains no raw `<` or `>`
- [ ] Unsubscribe link from a test campaign works and records opt-out

### 3.5 Security spot checks
- [ ] Request any CRM endpoint with no token → 401
- [ ] Request with a valid token but another organization's id in `X-Organization-Id` → 403
- [ ] Suspend a test user, then reuse their still-valid token → denied
- [ ] POST to each webhook without its secret/signature → 401
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` appears in **no** `NEXT_PUBLIC_*` variable and in no browser bundle

## 4. Post-launch, first 48 hours

- [ ] Watch `/health` and the delivery queue depth
- [ ] Confirm the first real website form submission produced **both** an email and a CRM record
- [ ] Confirm the first real inbound email reply threaded correctly rather than landing in "Needs review"
- [ ] Confirm no `DELIVERY_UNKNOWN` messages accumulate
- [ ] Watch website logs for `[api/forms/submit] platform persistence failed`

## 5. Accepted at launch

These are known and deliberately accepted — see §8 of the audit for full
reasoning. They are listed here so the decision is explicit rather than
discovered later.

| Risk | Accepted because | Watch for |
| --- | --- | --- |
| R1 — CRM outage loses the admin-panel copy of a form submission | The submitter still succeeds and the admin still gets the full email | The persistence-failure log line |
| R3 — CRM carries two postcss advisories | Closing them needs a Next 15→16 major upgrade; the CSS is not attacker-controlled | Schedule the upgrade as its own change |
| R4 — No in-process rate limiting | Every public write path requires a secret, token or provider signature | Apply limits at the proxy/CDN |
| R7 — Exactly-once delivery is not claimed | A possible silent non-delivery is preferred over duplicate messages to real people | `DELIVERY_UNKNOWN` count |

## 6. Scope confirmation

Confirmed **not** built and not started: External API & Integration
Architecture, Workflow Automation Engine, Provider Matching Engine, Advanced
Analytics & Reporting, Document & Compliance Management System, AI/predictive
features, provider ranking, scheduled or drip campaigns, billing and payments,
WhatsApp/RCS/MMS, Gmail/Outlook/IMAP sync, support ticketing, SLA engines, and
open/click tracking or A/B testing.

If any of these are wanted, they are new scope and should be planned separately.
