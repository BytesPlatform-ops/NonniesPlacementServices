# Communications Module

A CRM-owned marketing/outreach system. **Nonnis PostgreSQL is the source of
truth.** Brevo (email) and Twilio (SMS) are **future transport providers** — they
never own contacts, lists, consent, or history. This document covers **Phase 15A**
(the foundation) and **Phase 15B** (outbound email), and names the future phases.

> **PHI boundary:** the Communications contact database is deliberately separate
> from `User` / `Patient` / `Provider`. It never references `Case`/`Patient`
> records, and patient records are never bulk-imported. All demo data is fictional.

## Phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **15A** | Foundation: contacts, lists, tags, consent, suppression, imports, transport ports + mocks | **Complete** |
| **15B** | Email templates + visual builder + email campaigns (Brevo adapter) | **Complete** |
| 15C | Email inbox + inbound replies + full email threading | Planned |
| 15D | SMS campaigns + two-way SMS (Twilio adapter) | Planned |
| 15E | Unified communications inbox + security + delivery hardening | Planned |

## 1. Access (RBAC)

`communications.read` / `communications.manage` / `communications.import` /
`communications.send` (15B), granted only to **NONNIS_ADMIN** and
**NONNIS_OPERATIONS**. Discharge and provider users get none. Every endpoint is
authenticated + permission-gated; contacts are PII and are never exposed publicly.
`communications.send` specifically gates **all** campaign queueing and test sends.

## 2. Data model (additive migration `20260902010000_communications_foundation`)

- **`CommunicationContact`** — `firstName?`, `lastName?`, `email?` + `normalizedEmail?`
  (unique), `phone?` + `normalizedPhoneE164?` (unique), `organizationName?`, `source`
  (MANUAL/PASTE_IMPORT/CSV_IMPORT/TXT_IMPORT), `status` (ACTIVE/ARCHIVED). Nullable
  unique indexes allow many contacts with no email (or no phone) while preventing
  duplicate normalized addresses.
- **`ContactChannelPreference`** — unique `(contactId, channel)`; `consentStatus`
  UNKNOWN/OPTED_IN/OPTED_OUT, `consentSource?`, `consentAt?`, `optOutAt?`.
- **`CommunicationList`** + **`CommunicationListMember`** (unique `(listId, contactId)`).
- **`CommunicationTag`** (unique name) + **`CommunicationContactTag`** (unique `(contactId, tagId)`).
- **`CommunicationSuppression`** — unique `(channel, normalizedAddress)`, `reason`,
  `active`, `source`. Upsert/reactivate — never duplicate active rows.
- **`CommunicationImportBatch`** — summary counts only (never raw contact lists).
- **`CommunicationConversation`** / **`CommunicationMessage`** — minimal future-safe
  foundation so 15C/15D need no destructive migration. No UI, no sending in 15A.

## 3. Normalization & validation

- **Email:** trimmed; `normalizedEmail` = lowercase; **format** validation via
  class-validator's `isEmail` (explicitly not mailbox verification, and no paid
  verification vendor).
- **Phone:** `libphonenumber-js` → E.164. Numbers without an international prefix use
  an explicit **default country** (US default, always visible in the import UI).
- A contact must have at least one valid channel; empty contacts are rejected.

## 4. Duplicate & conflict rules

`classifyContactMatch` (pure, unit-tested): NEW when neither normalized address
matches; DUPLICATE when email or phone matches the same existing contact; **CONFLICT
when email matches contact A and phone matches a different contact B** — never
auto-merged, always flagged for manual review. Manual create/update reject
collisions (409); a `P2002` race is caught and surfaced as a clean conflict.

## 5. Imports (paste / CSV / TXT)

- The client reads the file and posts its **text** (paste/CSV/TXT all become text);
  the raw file is **never uploaded or stored**. Bounds: **5 MB** content, **25,000
  rows**; a real CSV parser (`csv-parse`) handles quoted commas / escaped quotes /
  embedded newlines (never `split(",")`); MIME/extension checked client-side.
- Flow: **Source → Configure/Map → Preview → Confirm → Commit.** Preview computes
  counts (Total / New / Duplicate / Invalid / Conflict / Suppressed) and a bounded
  sample **without mutating**; commit **re-validates server-side** (never trusts the
  preview), inserts NEW contacts in batches with `skipDuplicates` (race-safe),
  optionally updates only-empty fields on existing duplicates, and can add imported
  contacts to a list + tags. A `CommunicationImportBatch` records the summary and one
  `communication.contacts.imported` audit event carries **counts only**.
- **Suppression is preserved:** an actively-suppressed address is shown `SUPPRESSED`
  and is not imported as a fresh contact — re-import never resurrects an opt-out.
- A formula-injection-safe **error CSV** of rejected rows can be downloaded.

## 6. Consent & suppression policy

Consent is **channel-specific** and imports default to **UNKNOWN** — uploading an
address never implies consent (critical for SMS). Staff may set OPTED_IN/OPTED_OUT
manually with a source. `evaluateChannelEligibility(contact, channel)` is the
single, reusable policy that 15B/15D will use to build campaign recipients:
eligible only when the channel exists, the address is valid, consent is **OPTED_IN**
(UNKNOWN is never opted-in), the contact is not archived, and the address is not
suppressed. **15A sends nothing.**

## 7. Provider-independent transports

`EmailTransport` / `SmsTransport` interfaces + DI tokens (`EMAIL_TRANSPORT` /
`SMS_TRANSPORT`). Business logic depends on the **token**, never a vendor SDK.
Deterministic `MockEmailTransport` / `MockSmsTransport` return predictable IDs
(`mock-email-<uuid>` / `mock-sms-<uuid>`) and make **zero network calls**. A config
factory selects the implementation:

```
COMMUNICATIONS_EMAIL_PROVIDER=mock   # default; "brevo" reserved for 15B
COMMUNICATIONS_SMS_PROVIDER=mock     # default; "twilio" reserved for 15D
```

Unset → mock (dev/test never need live keys). A reserved live value fails **safely**
(explicit "not implemented yet" error) rather than silently selecting a live sender;
an unknown value also fails. Future live configuration (documented, not required
now, never committed): `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`;
`TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`,
`TWILIO_MESSAGING_SERVICE_SID`.

## 8. API surface

Under `/api/v1/communications` (all permission-gated):
`contacts` (list/counts/get/create/patch/consent/archive), `lists`
(list/options/get/members/create/patch/members add+remove), `tags`
(list/create/assign/unassign), `suppressions` (list/create/deactivate), `imports`
(csv-inspect/preview/commit). Import requests raise the JSON body limit to 6 MB.

## 9. CRM UI

A **Communications** nav group — **Contacts** (metric cards, server-side
search/filters, create/edit modal, consent controls, tags, archive, detail page),
**Lists** (table, create, member management modal with search-to-add), **Imports**
(the wizard). Warm Premium design system with `ConfirmProvider` / `ToastProvider` /
`MutationButton`. No campaign/inbox pages exist yet (no dead links).

## 10. Testing & anti-scope

Backend: normalization, eligibility, duplicate classification, CSV/paste
parsing, import preview classification (in-batch dup, existing dup, suppressed,
invalid, CSV mapping), contact conflict rules, RBAC, and mock-transport + fail-safe
factory. **15B adds**: email compiler (MJML + merge escaping), campaign audience
evaluation, delivery dispatcher, normalized delivery events + idempotency, unsubscribe
flow, and the Brevo transport adapter (mocked HTTP). Frontend (86 total): consent/
import labels + the client CSV sanitizer. Confirmed **absent** through 15B: SMS
send, inbound webhooks/replies, inbox UI, schedulers/cron/recurring sends, open/click
tracking, analytics, AI, external email validation, patient import.

---

## Phase 15B — Email templates, visual builder & campaigns

### Data model (additive migration `20260902020000_communications_email_campaigns`)

- **`CommunicationEmailTemplate`** — `subjectDefault?`, `preheaderDefault?`, a
  versioned block **`designJson`** (`{ version, settings, blocks }`), server-compiled
  **`compiledHtml`/`compiledText`**, `status` DRAFT/ACTIVE/ARCHIVED. The **backend
  compiler is authoritative** — the frontend never supplies trusted HTML.
- **`CommunicationEmailCampaign`** — `status`
  DRAFT→READY→QUEUED→SENDING→COMPLETED/PARTIALLY_FAILED/CANCELLED, optional
  `templateId`, an **immutable content snapshot** (`subject/preheader/html/text
  Snapshot`, `senderEmail/Name`) captured at queue time, `audienceConfig`
  (`{ listIds, contactIds }`), eligible/excluded counts, and lifecycle timestamps.
- **`CommunicationEmailCampaignRecipient`** — per-recipient **snapshots**
  (`emailSnapshot`, name/org), `deliveryStatus`
  (EXCLUDED/QUEUED/PROCESSING/SENT/DELIVERED/BOUNCED/FAILED/UNSUBSCRIBED/CANCELLED/
  DELIVERY_UNKNOWN), `exclusionReason?`, delivery bookkeeping (`attemptCount`,
  `claimToken`/`leaseExpiresAt`, `providerMessageId`), and opaque
  `unsubscribeToken`/`threadToken`. `contactId` is a scalar (no FK) so recipient
  history survives contact deletion.
- **`CommunicationEmailEvent`** — normalized provider events (ACCEPTED/DELIVERED/
  BOUNCED_HARD/BOUNCED_SOFT/BLOCKED/COMPLAINT/UNSUBSCRIBED/FAILED) with a unique
  `dedupKey` for idempotency. `CommunicationContact` gains a unique `unsubscribeToken`.

### Templates & the visual builder

Blocks: text / heading / image / button / columns / divider / spacer. The compiler
emits responsive HTML via **MJML** and a plain-text alternative. **Merge fields are
allow-listed** — `firstName`, `lastName`, `fullName`, `email`, `organizationName`,
plus the system `unsubscribeUrl` — and **all patient/case/diagnosis/clinical/insurance
fields are excluded by construction** (PHI boundary). Merge values are HTML-escaped
per recipient. Image/link URLs must be HTTPS (no localhost); campaign compilation
requires production media. The frontend **preview uses the same server compiler**
(`POST …/templates/preview`) — it never renders its own HTML.

### Campaigns & delivery

- **Sender is fixed** to the configured verified sender; only **From-Name** is
  user-editable (CRM users can never enter an arbitrary From address).
- **Two eligibility checks:** the 15A `evaluateChannelEligibility` policy (+
  suppression) runs at **queue time** and **again at send time** — a contact that
  became opted-out/suppressed between queue and send is **not sent** (marked
  UNSUBSCRIBED/CANCELLED).
- **Queue, not inline send:** queueing snapshots content + recipients and returns
  immediately. A **Postgres-backed dispatcher** claims recipients with `FOR UPDATE
  SKIP LOCKED` (multi-instance safe), sends with bounded concurrency, and retries
  transient failures with backoff (max 3). **Ambiguous** sends become
  `DELIVERY_UNKNOWN` and are **never blindly retried**.
- **Cancellation** stops not-yet-sent recipients; already-sent emails cannot be recalled.

```
COMMUNICATIONS_EMAIL_PROVIDER=mock   # default; "brevo" selects the live adapter
EMAIL_DISPATCH_ENABLED=true          # dispatcher poll loop (mock-safe)
# live-only, never committed: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
```

The **Brevo** adapter posts to `api.brevo.com/v3/smtp/email` behind the 15A
`EmailTransport` port. Mock stays the default and needs no keys; selecting `brevo`
without a key **fails at DI resolution** (never silently mocks). The API key is never
exposed through any API, logged, or committed.

### Delivery events, suppression & unsubscribe

A **secret-guarded** webhook (`POST …/communications/email/webhook?secret=…`,
constant-time compare, 401 without a configured secret) ingests delivery events
idempotently (dedupKey). Hard bounce → BOUNCED + suppress; complaint → suppress +
opt-out; unsubscribe → UNSUBSCRIBED + suppress + opt-out. The **public unsubscribe**
page lives on the marketing site and uses an **opaque token** (no id/email in the
URL); one-click `List-Unsubscribe`/`List-Unsubscribe-Post` headers are set on every
send. Raw webhook payloads are not stored unbounded.

### API surface (15B additions)

Under `/api/v1/communications/email` (permission-gated): `templates`
(list/get/create/patch/duplicate/archive/**preview**/**test-send**), `campaigns`
(list/get/create/patch/**audience-preview**/**queue**/**cancel**/recipients),
`status`. Public + `@SkipTransform`: the delivery webhook and
`/api/v1/public/communications/unsubscribe` (status/perform). Queue, cancel, and
test-send require `communications.send`; **queue and cancel require confirmation** in
the UI.

### CRM UI

**Email Templates** (list + visual builder with live preview, merge chips, and a
rate-limited test send) and **Email Campaigns** (a Details→Template→Audience→Review
wizard with a recipient-eligibility preview, and a campaign detail page with count
cards, a filterable recipient table, live status polling while sending, and
cancel/queue actions). A **mock-mode banner** shows when no live provider is
configured. Warm Premium design system throughout.
