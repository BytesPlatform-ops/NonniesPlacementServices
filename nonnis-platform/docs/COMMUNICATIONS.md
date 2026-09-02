# Communications Module

A CRM-owned marketing/outreach system. **Nonnis PostgreSQL is the source of
truth.** Brevo (email) and Twilio (SMS) are **future transport providers** — they
never own contacts, lists, consent, or history.

**The Communications module is COMPLETE** across phases 15A–15E: the foundation
(15A), outbound email (15B), the email inbox and inbound replies (15C), SMS and
two-way messaging (15D), and the unified inbox plus security/delivery/operations
hardening (15E).

> **PHI boundary:** the Communications contact database is deliberately separate
> from `User` / `Patient` / `Provider`. It never references `Case`/`Patient`
> records, and patient records are never bulk-imported. All demo data is fictional.

## Phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **15A** | Foundation: contacts, lists, tags, consent, suppression, imports, transport ports + mocks | **Complete** |
| **15B** | Email templates + visual builder + email campaigns (Brevo adapter) | **Complete** |
| **15C** | Email inbox + inbound replies + full email threading + attachments | **Complete** |
| **15D** | SMS templates + campaigns + two-way SMS (Twilio adapter) | **Complete** |
| **15E** | Unified inbox + security, delivery and operations hardening | **Complete** |

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
flow, and the Brevo transport adapter (mocked HTTP). **15C adds**: reply-address
format/parse, thread-header helpers, reply Markdown compiler, inbound HTML
sanitization, shared send-outcome policy, attachment policy, the Brevo/mock inbound
adapters, and the inbound threading/idempotency/sender-check service. Frontend:
consent/import labels, the client CSV sanitizer, and inbox formatting. Confirmed
**absent** through 15C: SMS send/inbound, Gmail/IMAP/Graph mailbox sync,
schedulers/cron/recurring sends, open/click tracking, analytics, AI, external email
validation, patient import. **15D adds**: the GSM-7/UCS-2 segment calculator, SMS
merge fields, the Twilio transport + inbound adapters (signature validation exercised
with real HMAC fixtures), the SMS dispatcher's send-time opt-out recheck, status
callback ordering, and STOP/START/HELP handling. Confirmed **absent** through 15D:
MMS send/fetch, scheduled or recurring SMS, link/click tracking, SMS analytics, AI,
and any patient/clinical merge field.

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

---

## Phase 15C — Email inbox, inbound replies, threading & attachments

The CRM becomes the source of truth for two-way email: staff manage the full
campaign/reply workflow **inside Nonnis** without Gmail/IMAP. Brevo is only email
**transport + inbound provider**. No Gmail OAuth, Google/Microsoft mailbox sync, or
IMAP polling — inbound is push-only via Brevo inbound parsing → the CRM webhook.

### Data model (additive migration `..._communications_email_inbox`)

- **`CommunicationConversation`** (extended) — `threadToken` (unique opaque per-
  conversation token backing the reply address), `lastInboundAt` / `lastOutboundAt`
  (cheap `needsReply` derivation), `latestDirection`, `previewText`, `archivedAt`,
  `originCampaignId` (SetNull), `status` gains `ARCHIVED`.
- **`CommunicationMessage`** (extended) — threading (`messageId` = RFC/Internet
  Message-ID, distinct from the provider API `providerMessageId`; `inReplyTo`,
  `references`), addresses (`fromAddress/Name`, `toAddress`, `replyToAddress`),
  `providerInboundId` (unique — inbound idempotency), `autoSubmitted`, sanitized
  `htmlBody` + `previewText`, and a direct-reply **outbox** (claim/lease/attempt/
  backoff/error fields). `status` gains `PROCESSING`, `BOUNCED`, `DELIVERY_UNKNOWN`.
- **`CommunicationConversationReadState`** — per-user `lastReadAt` (unique
  `conversationId+userId`) so unread is per staff member, not global.
- **`CommunicationInboundEmailReview`** — safe quarantine for inbound that fails
  correlation or a sender check (PENDING/LINKED/DISMISSED). Only review-relevant
  fields are kept — never the raw provider payload.
- **`CommunicationMessageAttachment`** — inbound/outbound attachment metadata; the
  binary lives in a **private** bucket (only `storagePath` is stored, never a public URL).

### Inbound provider abstraction

`EmailInboundAdapter` port (DI token `INBOUND_EMAIL_ADAPTER`) with
`MockEmailInboundAdapter` and `BrevoEmailInboundAdapter`, selected by
`COMMUNICATIONS_INBOUND_EMAIL_PROVIDER` (fail-safe: `brevo` without domain+secret
throws at DI resolution). Business services consume the **normalized** result only —
no `if (provider === "brevo")` in conversation logic. Brevo parsing reads `items[]`
(`From/To/Cc/Recipients/ReplyTo`, `MessageId/InReplyTo`, `RawTextBody/RawHtmlBody`,
`Headers` for References/Auto-Submitted, `SentAtDate`, attachment `DownloadToken`s).

### Opaque reply address & correlation

One canonical formatter/parser produces `reply-<threadToken>@<inbound-domain>`
(config-driven domain; mock uses `reply.mock.local`). The token is high-entropy and
never encodes a contact/campaign id or email. Outbound campaign **and** reply email
set `Reply-To` to the conversation address so a recipient's normal Reply routes back.
Correlation is deterministic: **(1) opaque token → (2) In-Reply-To → (3) References**
(newest first). **Subject text is never a correlation key.** After correlation, the
inbound `From` is normalized and compared to the conversation contact's email; a
mismatch is quarantined (`THREAD_SENDER_MISMATCH` / `HEADER_SENDER_MISMATCH`) — the
message is **never** appended to the wrong person's thread, and a stranger is **never**
auto-created as a contact.

### Replies reuse the 15B send infrastructure

A CRM reply is authored in a controlled **Markdown subset** (bold/italic/link/lists);
the backend validates, sanitizes, compiles to email-safe HTML + a text fallback, and
enqueues a **QUEUED outbound message**. The 15B dispatcher gained a second claim path
(FOR UPDATE SKIP LOCKED over outbound messages) and both paths share **one**
`classifySendResult` policy (transient retry + backoff, ambiguous→`DELIVERY_UNKNOWN`
never blind-retried, permanent→FAILED with manual Retry). `From` is always the
verified sender; the recipient is always the conversation contact (no arbitrary To,
no CC/BCC). Threading headers (`Message-Id`, `In-Reply-To`, a **bounded** `References`
chain) go through the transport as ordinary headers. The one delivery-event webhook
now updates campaign recipients **and** reply messages.

### Safety

Inbound HTML is sanitized server-side (`sanitize-html`): scripts/iframes/forms/event
handlers/unsafe URL schemes removed, inline styles stripped, and **`<img>` removed
entirely** so remote tracking pixels never load when staff open a message. A plain-text
part is always stored. Attachments use a conservative MIME allowlist + size limits
(5 files, 10 MB each, 20 MB/message; executables blocked), server-generated storage
paths (never the provider filename), a **private** Supabase bucket, and short-lived
signed download URLs (`communications.read`). There is **no malware scanning** — MIME/
size controls only (production-hardening item). `needsReply` excludes delivery events
and auto-responders (`Auto-Submitted`/`Precedence`). Manual human reply is allowed even
to an opted-out/suppressed contact (an inbound request deserves an answer) but a reply
**never** clears marketing suppression or flips consent back to OPTED_IN.

### Webhooks & RBAC

The inbound-content webhook is **separate** from the delivery-event webhook, provider-
authenticated by a high-entropy secret (`?secret=` or `x-inbound-secret` — Brevo inbound
is not signed; documented limitation), body-size bounded, and idempotent (dedup on
`providerInboundId`, else RFC Message-ID + conversation). Reads use `communications.read`;
reply/retry use `communications.send`; archive/restore and review link/dismiss use
`communications.manage`. Provider/discharge roles get none.

### CRM UI

`Communications → Inbox` (`/communications/inbox`): a shared inbox with All / Unread /
Needs Reply / Archived / Needs Review tabs (server-side search + pagination + per-user
unread + review badges), a conversation thread distinguishing inbound/outbound/status,
a reply composer (B/I/link/lists toolbar, ⌘B/⌘I/⌘K, attachments, queued→sent states),
contact context (consent/suppression/lists/tags — never PHI), a "Started from campaign"
link, and a review queue to link (to an existing contact) or dismiss unmatched mail.

### Configuration

```
COMMUNICATIONS_EMAIL_PROVIDER=mock|brevo
COMMUNICATIONS_INBOUND_EMAIL_PROVIDER=mock|brevo
COMMUNICATIONS_INBOUND_EMAIL_DOMAIN=reply.nonnis.com   # mock default: reply.mock.local
COMMUNICATIONS_INBOUND_EMAIL_SECRET=<high-entropy secret>   # guards the inbound webhook
COMMUNICATIONS_INBOUND_MAX_BODY_BYTES=524288
COMMUNICATIONS_INBOUND_MAX_ATTACHMENT_BYTES=10485760
COMMUNICATIONS_INBOUND_MAX_ATTACHMENTS=5
# reused from 15B: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
```

Everything works locally in **mock mode** with no Brevo credentials. Simulate inbound
replies with `npm run communications:simulate-email-reply -- --conversation <id> --text "…"`
(refuses to run in production). Going live requires **configuration only, not a redesign**:

**What the client must configure in Brevo/DNS (production):**
1. A verified sender / sending domain (already needed for 15B).
2. A dedicated inbound **reply subdomain** (e.g. `reply.nonnis.com`).
3. DNS **MX** records pointing that subdomain at Brevo's inbound servers.
4. A Brevo **Inbound Parsing** route for the subdomain.
5. The inbound **webhook URL**: `https://<api-host>/api/v1/webhooks/communications/email/inbound?secret=<COMMUNICATIONS_INBOUND_EMAIL_SECRET>`.
6. Set `COMMUNICATIONS_INBOUND_EMAIL_PROVIDER=brevo`, `COMMUNICATIONS_INBOUND_EMAIL_DOMAIN`, `COMMUNICATIONS_INBOUND_EMAIL_SECRET`.
7. Real send → reply → CRM end-to-end test.

---

## Phase 15D — SMS templates, campaigns & two-way SMS

Bulk and conversational SMS, managed entirely in the CRM. Twilio is only the SMS
**transport + inbound provider** behind the 15A `SmsTransport` port — business logic
never sees a Twilio object and never branches on the provider name.

### Data model (additive migration `..._communications_sms`)

- **`CommunicationSmsTemplate`** — plain-text `body` (no HTML, no Markdown, no page
  builder), DRAFT/ACTIVE/ARCHIVED.
- **`CommunicationSmsCampaign`** — status DRAFT→QUEUED→SENDING→COMPLETED/
  PARTIALLY_FAILED/CANCELLED, immutable `bodySnapshot`, `audienceConfig`, and the
  aggregate estimate (`estimatedSegmentCount`, GSM-7/UCS-2/multi-segment counts,
  longest rendered body).
- **`CommunicationSmsCampaignRecipient`** — per-recipient snapshots taken at queue
  time (`phoneSnapshot`, name/org, the fully merge-rendered `bodySnapshot`,
  `encodingSnapshot`, `estimatedSegmentCount`), provider-neutral `deliveryStatus`,
  `providerMessageId`, the `actualFromNumber` Twilio chose, `providerSegmentCount`,
  and the same claim/lease/attempt bookkeeping the email outbox uses.
- **`CommunicationConversation`** (extended) — `businessNumber` (the Nonnis/Twilio
  number a thread runs through) and `originSmsCampaignId`.
- **`CommunicationMessage`** (extended) — `encoding`, `segmentCount`,
  `providerSegmentCount`, `smsOptOutType`, `undeliveredAt`; statuses gain
  `ACCEPTED` and `UNDELIVERED`.
- The 15C inbound **review queue** gains a `channel` discriminator and SMS reasons
  (`UNKNOWN_PHONE`, `PHONE_CONFLICT`, `UNKNOWN_BUSINESS_NUMBER`,
  `INVALID_PROVIDER_PAYLOAD`) — one review system serves both channels.

### Segment calculator

Deterministic GSM 03.38 / UCS-2 calculation, never `Math.ceil(len / 160)`:
GSM-7 **160** single / **153** concatenated, UCS-2 **70** / **67**. GSM extended
characters (`^ { } \ [ ~ ] | €` and form-feed) cost **two** septets, and a two-unit
character (an extended pair or an emoji surrogate pair) is never split across a
segment boundary — so segments are packed, not divided. It returns encoding,
character count, encoded units, segment count, remaining capacity and a
multi-segment flag. A client-side mirror gives instant typing feedback and is pinned
to the backend by parity tests; the **backend is authoritative** and re-renders every
recipient at queue time, because `{{firstName}}` changes both length and encoding.
This is an **estimate, not an invoice** — some sender types concatenate differently
and carrier billing varies, so the UI always says "estimated billable segments".

### Campaigns

Merge fields reuse the SAME allow-list as email (`firstName`, `lastName`,
`fullName`, `email`, `organizationName`); an unknown field is rejected loudly so
`{{something}}` never reaches a handset, and patient/clinical fields do not exist.
Audience eligibility reuses `evaluateChannelEligibility(contact, SMS)` — OPTED_IN
required, UNKNOWN never eligible, plus not archived / valid E.164 / not suppressed —
with a deduped union across lists. Queueing revalidates everything server-side and
writes per-recipient snapshots; the HTTP request never sends messages.

### Dispatch

The SMS dispatcher mirrors the email one and **shares the exact same
`classifySendResult` policy**: transient retry with backoff, `AMBIGUOUS` →
`DELIVERY_UNKNOWN` (never a duplicate SMS), everything else permanent. Claiming uses
Postgres `FOR UPDATE SKIP LOCKED` with bounded batch size and concurrency, so two
instances never send the same recipient and Twilio is never hammered. Immediately
before each provider call the recipient's **current** consent and suppression are
re-checked — a contact who texts STOP after the campaign was queued is cancelled,
never sent. The same worker drains direct 1:1 replies from the message outbox.

### Two-way SMS

Correlation is deterministic on **(contact normalized E.164, Nonnis business
number)** — never message text — so a Messaging Service that later holds several
senders stays correct. Unknown numbers are **quarantined for review** and a stranger
is **never** auto-created as a contact. Inbound is idempotent on Twilio's
`MessageSid`. Media is noted but never fetched or stored (MMS is out of scope).
Replies are plain text to the conversation contact only — no arbitrary To, no
CC/BCC, and the sender is always the configured Twilio identity.

### Opt-out / opt-in

Twilio Advanced Opt-Out sends an authoritative `OptOutType` (`STOP` / `START` /
`HELP`) and has **already replied to the customer**, so the CRM never sends a
duplicate and never returns TwiML. A conservative fallback classifies only a bare
documented keyword (case-insensitive, whole message) — "please stop sending these"
stays a normal conversation.

- **STOP** → consent OPTED_OUT + an active `USER_OPT_OUT` SMS suppression. This
  blocks bulk campaigns **and** direct staff replies immediately.
- **START** → releases **only** the `USER_OPT_OUT` suppression (never ADMIN_BLOCK or
  another reason), restores consent with `consentSource=TWILIO_START`, and writes an
  audit event so re-opt-in is traceable.
- **HELP** → recorded; consent untouched.
- Twilio error **21610** on an outbound send means the carrier is blocking us because
  the recipient opted out; that documented semantic justifies synchronizing CRM
  suppression + consent. An admin removing a suppression never overrides a provider
  STOP — the recipient must text START.
- STOP/START/HELP never mark a thread as needing a staff reply.

### Webhooks

Two **separate** endpoints, both verified with the **official Twilio validator**
(`validateRequest`, HMAC-SHA1 over the exact public URL plus the complete unmodified
parameter set) before any parsing or persistence — no home-grown HMAC:

```
POST /api/v1/webhooks/communications/sms/inbound   # customer message content
POST /api/v1/webhooks/communications/sms/status    # outbound delivery status
```

Validation uses the configured **public** base URL, not a proxy-rewritten request
URL, and the Account **Auth Token** (API Keys do not work for webhook validation).
Twilio does not guarantee callback ordering, so statuses are applied through a
monotonic rank: a late `sent` can never regress `delivered`, a repeated callback is a
no-op, and `DELIVERY_UNKNOWN` ranks low on purpose so a later authoritative callback
resolves an ambiguous send. Both endpoints return 204 with no TwiML. In mock mode the
webhook verifier refuses outright when `NODE_ENV=production`, so a mock deployment
can never expose an unauthenticated inbound endpoint.

### CRM UI

**SMS Templates** (editor with merge-field chips, live character/encoding/segment
readout, multi-segment and Unicode warnings, server-rendered preview, rate-limited
test send) and **SMS Campaigns** (Details → Message → Audience → Review wizard with
an eligibility + segment summary, and a detail page with delivery counts and a
server-paginated recipient table). The existing **Inbox** gains All / Email / SMS
channel filters, SMS conversation rows, an SMS thread, and a plain-text SMS composer
with a live segment count. The contact detail lists both channels' threads.

### Configuration

```
COMMUNICATIONS_SMS_PROVIDER=mock|twilio
TWILIO_ACCOUNT_SID=
TWILIO_API_KEY_SID=            # preferred send credentials
TWILIO_API_KEY_SECRET=
TWILIO_AUTH_TOKEN=             # webhook signature validation ONLY — server-only secret
TWILIO_MESSAGING_SERVICE_SID=  # preferred sender
TWILIO_PHONE_NUMBER=           # optional single-number fallback
COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL=
TWILIO_A2P_APPROVED=false
SMS_DISPATCH_ENABLED=true
SMS_DISPATCH_BATCH_SIZE=20
SMS_DISPATCH_CONCURRENCY=3
```

Selecting `twilio` without complete configuration **fails at DI resolution** — it
never silently falls back to the mock. Live **bulk campaign** sending additionally
requires a Messaging Service (or number) and the operator A2P acknowledgement;
conversational 1:1 replies are not gated on the A2P campaign flag, but STOP /
suppression always blocks every outgoing message.

Everything works in **mock mode** with no Twilio account. Simulate locally with
`npm run communications:simulate-sms -- inbound --from +14155550161 --body "Yes"`,
`… --body STOP --opt-out STOP`, and
`npm run communications:simulate-sms -- status --sid <MessageSid> --status delivered`
(the command refuses to run in production; there is no production simulation endpoint).

**What the client must configure to go live:**
1. Twilio account + an SMS-capable number.
2. A **Messaging Service** containing that sender, with Advanced Opt-Out enabled.
3. **A2P 10DLC** brand/campaign registration approved by Twilio/the carriers.
4. Inbound webhook → `https://<api-host>/api/v1/webhooks/communications/sms/inbound`.
5. Status callback → `https://<api-host>/api/v1/webhooks/communications/sms/status`
   (set `COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL` to that exact public host).
6. Set the Twilio env vars above, `TWILIO_A2P_APPROVED=true`, and switch
   `COMMUNICATIONS_SMS_PROVIDER=twilio`.
7. A real send → reply → STOP/START end-to-end test.

---

## Phase 15E — Unified inbox, security, delivery & operations hardening

The final Communications phase. It adds no marketing features: it makes the existing
Email + SMS system coherent, safe, recoverable, observable and production-ready.

### Unified inbox

`/communications/inbox` is the single inbox for both channels — there is deliberately
no separate "SMS inbox" product. Channel filters (**All / Email / SMS**) sit above the
operational filters (**Unread / Needs Reply / Archived / Needs Review**), and channel,
filter, search and page are all mirrored into the URL so refresh, deep links and
browser-back restore the same view. Rows share one structure (contact, channel badge
with icon **and** text, preview, direction, time, unread, needs-reply, campaign
origin); email rows show a subject, SMS rows show the phone identity instead of a fake
one. Sorting is by latest activity across channels, never grouped by channel. Search
covers contact name, email, phone, organization and email subject — never a full
message-body scan.

Inbound review is one queue for both channels, and its reasons are **normalized to
provider-neutral codes** (`UNKNOWN_CONTACT`, `AMBIGUOUS_CONTACT`,
`SENDER_IDENTITY_MISMATCH`, `UNKNOWN_THREAD`, `UNKNOWN_BUSINESS_DESTINATION`,
`INVALID_PROVIDER_PAYLOAD`) so Brevo/Twilio wording never reaches the UI. The stored
enum keeps the channel-specific detail for support.

### Shared delivery core

All four outboxes — email campaign, email reply, SMS campaign, SMS reply — share one
`classifySendResult` policy: transient retry with bounded backoff and a bounded
attempt cap, **AMBIGUOUS → `DELIVERY_UNKNOWN` with no automatic retry**, and everything
else (permanent, configuration, provider opt-out block) terminal. Claiming is Postgres
`FOR UPDATE SKIP LOCKED` with bounded batch size and concurrency, so multiple
instances never send the same row and a cancelled campaign's work is never newly
claimed.

**Crash recovery.** `dispatchedAt` is stamped immediately BEFORE the provider call,
which makes an expired lease unambiguous:

| Expired lease | Meaning | Action |
| --- | --- | --- |
| `dispatchedAt` is NULL | the worker died before the provider saw anything | safely re-queued (attempt counted, so it cannot loop) |
| `dispatchedAt` is set | the provider may already have accepted it | `DELIVERY_UNKNOWN` — **never** resent automatically |

A row already in `DELIVERY_UNKNOWN` is never reclaimed, and repeated crashes exhaust
the shared attempt cap into a terminal `FAILED` rather than looping. The same
maintenance pass finalizes campaigns whose recipients are all terminal, so a campaign
can never be stuck in `SENDING` after a worker restart. This is delivery-queue
recovery, not workflow automation, and it runs inside the existing dispatcher ticks —
no new scheduler was introduced.

**Residual risk (documented, not hidden).** Neither provider exposes a true
idempotency key for message creation, so a crash in the narrow window between the
provider accepting a message and our database recording it cannot be distinguished
from a crash before sending. The system therefore always prefers
`DELIVERY_UNKNOWN` + human review over a possible duplicate delivery.

### Send idempotency

Campaign queueing atomically CLAIMS the `DRAFT → QUEUED` transition inside the same
transaction that writes recipient snapshots; a concurrent duplicate request updates
zero rows and the whole transaction rolls back. Recipient rows additionally use a
deterministic `campaignId:contactId` key, so a retried queue can never duplicate a
recipient. Direct replies accept a client `idempotencyKey`, scoped per conversation
and enforced by a unique index — a double-click, a browser retry or a genuine race all
return the original message instead of sending twice.

### Delivery operations

`/communications/delivery` lists only **actionable** deliveries (`FAILED`,
`DELIVERY_UNKNOWN`, `BOUNCED`, `UNDELIVERED`) across all four outboxes in one
server-paginated query, filterable by channel, type and status. Retry is deliberately
honest rather than convenient:

- **Ambiguous** — retry is offered but demands an explicit acknowledgement that the
  message may already have been delivered. Never a quiet one-click resend.
- **Bounced / undelivered / permanently invalid / provider opt-out** — retry is
  disabled, with the reason shown.
- **Configuration failure or exhausted transient** — retry is offered plainly, because
  nothing ever reached the recipient.

The same rules are re-evaluated server-side; the frontend is never trusted. Retrying a
recipient of a finalized campaign reopens that campaign so the dispatcher can actually
claim the row again.

### Configuration & health

`/communications/configuration` shows per-channel provider, readiness
(**Mock / Ready for live / Missing configuration**), an explicit list of what is still
missing, and display-safe details. Readiness is derived purely from configuration — no
provider API is called and **no probe message is ever sent**. The endpoint never
returns `BREVO_API_KEY`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SECRET`, the unsubscribe
or webhook secrets, or the storage service-role key (asserted by tests across every
provider combination). Mixed mode is fully supported — live email with mock SMS, or the
reverse. `GET /communications/health` (manage permission) reports current queue counts,
stale claims, failures and pending reviews — operational counts only, no trends or
scores.

### Security hardening

- **Body limits are per route**, replacing a single application-wide allowance:
  6 MB only for contact imports, 512 KB for Brevo delivery events, 1 MB for Brevo
  inbound email, 128 KB for Twilio webhooks, 2 MB for ordinary CRM traffic. Oversized
  and malformed bodies now return **413 / 400** instead of 500.
- **Webhook authentication** is unchanged in mechanism but audited: Twilio uses the
  official validator against the **configured public URL** (never a proxy-rewritten
  one) with the full unmodified parameter set; Brevo, which publishes no signature
  scheme, uses constant-time high-entropy secret comparison. In mock mode the SMS
  webhook verifier refuses outright when `NODE_ENV=production`.
- **Idempotency** is enforced on every provider path: delivery events by dedup key,
  inbound email by provider id / RFC Message-ID, inbound SMS and status callbacks by
  `MessageSid`, with monotonic status ranking so out-of-order callbacks never regress
  `delivered`. No raw provider payloads are retained.
- **Attachments**: private bucket, MIME allowlist, size limits, server-generated
  paths, authorization on download, and a **configurable signed-URL TTL** (default 5
  minutes, clamped to 60s–15m). Download filenames are sanitized so a malicious
  inbound filename cannot inject a `Content-Disposition` response header.
- **Content**: inbound email stays sanitized (no scripts/iframes/forms/handlers/
  `javascript:` URLs, and images stripped so tracking pixels never load); email
  previews render in a sandboxed frame; the reply composer accepts only a controlled
  Markdown subset; SMS is never interpreted as HTML.
- **Authorization** is asserted structurally: a test walks every communications
  controller and fails if any endpoint is neither explicitly public (provider webhooks,
  public unsubscribe) nor gated by a communications permission — navigation is not
  authorization.

### Consent invariants (audited)

Email and SMS consent and suppression are fully independent: an email unsubscribe
never affects SMS eligibility, and an SMS STOP never changes email consent or
suppression. Bulk sending on either channel requires an active contact, a valid
address, `OPTED_IN` consent and no suppression — `UNKNOWN` is never treated as
consent. `START` releases only the `USER_OPT_OUT` SMS suppression and never clears an
`ADMIN_BLOCK` or any unrelated reason. A direct human email reply remains permitted
under the 15C policy without clearing suppression or flipping consent; a direct SMS
reply is always blocked by STOP/suppression.

### Data retention

No automatic deletion is implemented and no purge job was added. Retention for
contacts, campaign history, messages, attachments, provider dedup records, inbound
review items and audit events should be agreed with the client (and any legal
requirement) before production, then implemented deliberately.

### Post-15E next step

**Full Core-System Audit + Production Hardening** — a platform-wide pass beyond
Communications. It is not started automatically.
