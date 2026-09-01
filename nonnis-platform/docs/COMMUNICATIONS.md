# Communications Module

A CRM-owned marketing/outreach system. **Nonnis PostgreSQL is the source of
truth.** Brevo (email) and Twilio (SMS) are **future transport providers** — they
never own contacts, lists, consent, or history. This document covers **Phase 15A**
(the foundation) and names the future phases.

> **PHI boundary:** the Communications contact database is deliberately separate
> from `User` / `Patient` / `Provider`. It never references `Case`/`Patient`
> records, and patient records are never bulk-imported. All demo data is fictional.

## Phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **15A** | Foundation: contacts, lists, tags, consent, suppression, imports, transport ports + mocks | **Complete** |
| 15B | Email templates + visual builder + email campaigns (Brevo adapter) | Planned |
| 15C | Email inbox + inbound replies + full email threading | Planned |
| 15D | SMS campaigns + two-way SMS (Twilio adapter) | Planned |
| 15E | Unified communications inbox + security + delivery hardening | Planned |

## 1. Access (RBAC)

`communications.read` / `communications.manage` / `communications.import`, granted
only to **NONNIS_ADMIN** and **NONNIS_OPERATIONS**. Discharge and provider users get
none. Every endpoint is authenticated + permission-gated; contacts are PII and are
never exposed publicly.

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

Backend (309 total): normalization, eligibility, duplicate classification, CSV/paste
parsing, import preview classification (in-batch dup, existing dup, suppressed,
invalid, CSV mapping), contact conflict rules, RBAC, and mock-transport + fail-safe
factory. Frontend (86 total): consent/import labels + the client CSV sanitizer.
Confirmed **absent**: real Brevo/Twilio calls, bulk email/SMS send, campaign/template
builder, inbound webhooks, inbox UI, schedulers/cron, analytics, AI, external email
validation, patient import.
