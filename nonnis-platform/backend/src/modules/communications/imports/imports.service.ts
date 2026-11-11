import { BadRequestException, Injectable } from "@nestjs/common";
import type { CommunicationChannel, CommunicationContactSource } from "@prisma/client";
import type { CountryCode } from "libphonenumber-js";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { SuppressionsService } from "../suppressions/suppressions.service";
import { ListsService } from "../lists/lists.service";
import { TagsService } from "../tags/tags.service";
import { classifyContactMatch, type ExistingLookup } from "../duplicate";
import { isSupportedCountry, toEmailValue, toPhoneValue } from "../normalization";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseCsvContent, parseTxtLines, splitPasted } from "../import-parse";
import type { CsvInspectDto, ImportCommitDto, ImportPreviewDto } from "../dto/imports.dto";
import { consentFields, mayApplyConsent, parseConsentCell, resolveImportConsent, type ExplicitConsent } from "../consent";

export type ImportRowStatus = "NEW" | "DUPLICATE" | "INVALID" | "CONFLICT" | "SUPPRESSED";

export interface ImportRowResult {
  row: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  /** Consent this import will record for the row (null = leaves it as it is). */
  emailConsent: ExplicitConsent | null;
  smsConsent: ExplicitConsent | null;
  status: ImportRowStatus;
  issue: string | null;
}

/** How many consent statements the import carries (preview) or recorded (commit). */
export interface ImportConsentCounts {
  emailOptedIn: number;
  emailOptedOut: number;
  smsOptedIn: number;
  smsOptedOut: number;
}

export interface ImportCounts {
  total: number;
  new: number;
  duplicate: number;
  invalid: number;
  conflict: number;
  suppressed: number;
}

export interface ImportPreviewResult {
  sourceType: string;
  counts: ImportCounts;
  sampleRows: ImportRowResult[];
  problemRows: ImportRowResult[];
  consentCounts: ImportConsentCounts;
  truncated: boolean;
}

export interface ImportCommitResult extends ImportCounts {
  batchId: string;
  importedCount: number;
  listId: string | null;
  tagIds: string[];
  /** Consent actually written — an opt-in never replaces an existing opt-out. */
  consentApplied: ImportConsentCounts;
}

interface ProcessedRow extends ImportRowResult {
  normalizedEmail: string | null;
  normalizedPhoneE164: string | null;
}

const SOURCE_MAP: Record<string, CommunicationContactSource> = {
  PASTE: "PASTE_IMPORT",
  CSV: "CSV_IMPORT",
  TXT: "TXT_IMPORT",
};

const SAMPLE_LIMIT = 200;
const PROBLEM_LIMIT = 2000;
const CHUNK = 1000;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly suppressions: SuppressionsService,
    private readonly lists: ListsService,
    private readonly tags: TagsService,
  ) {}

  /** Show CSV headers + a few sample rows so the user can map columns. */
  inspectCsv(dto: CsvInspectDto): { headers: string[]; sampleRows: string[][] } {
    this.assertSize(dto.content);
    const parsed = parseCsvContent(dto.content);
    return { headers: parsed.headers, sampleRows: parsed.rows.slice(0, 5) };
  }

  async preview(dto: ImportPreviewDto): Promise<ImportPreviewResult> {
    const { rows, counts } = await this.process(dto);
    const problemRows = rows.filter((r) => r.status !== "NEW").slice(0, PROBLEM_LIMIT);
    return {
      sourceType: dto.sourceType,
      counts,
      sampleRows: rows.slice(0, SAMPLE_LIMIT).map(strip),
      problemRows: problemRows.map(strip),
      consentCounts: countConsent(rows),
      truncated: rows.length > SAMPLE_LIMIT,
    };
  }

  async commit(user: RequestUser, dto: ImportCommitDto): Promise<ImportCommitResult> {
    // `smsConsentSource` is the earlier, SMS-only form of `consent`; read it the same way.
    const legacySource = dto.smsConsentSource?.trim();
    if (legacySource && !dto.consent) dto = { ...dto, consent: { sms: true, source: legacySource } };
    // Re-validate server-side — never trust the preview as authoritative.
    const { rows, counts } = await this.process(dto);
    const newRows = rows.filter((r) => r.status === "NEW");
    const source = SOURCE_MAP[dto.sourceType];

    const createdIds = await this.insertNewContacts(user, newRows, source);
    // Runs after the insert so new contacts and existing duplicates go through
    // the same rule: an opt-in fills UNKNOWN only, an opt-out always records.
    const consentApplied = await this.applyConsent(
      user,
      rows.filter((r) => r.status === "NEW" || r.status === "DUPLICATE"),
      consentSourceLabel(dto),
    );

    // Optional update-empty-only for existing duplicates.
    if (dto.updateEmptyOnly) {
      await this.updateEmptyFields(rows.filter((r) => r.status === "DUPLICATE"));
    }

    // Optional list + tag assignment (only successfully imported contacts).
    let listId: string | null = null;
    if (dto.newListName && dto.newListName.trim()) listId = await this.lists.ensureByName(user, dto.newListName);
    else if (dto.listId) listId = dto.listId;
    let tagIds: string[] = [];
    if (dto.tagNames && dto.tagNames.length) tagIds = await this.tags.ensureByNames(dto.tagNames);

    if (createdIds.length > 0) {
      if (listId) {
        for (const chunk of chunked(createdIds, CHUNK)) {
          await this.lists.addMembers(user, listId, { contactIds: chunk });
        }
      }
      if (tagIds.length) await this.tags.assignManyToContacts(createdIds, tagIds);
    }

    const batch = await this.prisma.communicationImportBatch.create({
      data: {
        sourceType: source,
        originalFilename: dto.originalFilename ?? null,
        totalRows: counts.total,
        importedCount: createdIds.length,
        duplicateCount: counts.duplicate,
        invalidCount: counts.invalid,
        conflictCount: counts.conflict,
        suppressedCount: counts.suppressed,
        createdByUserId: user.id,
      },
    });

    await this.audit.record({
      action: "communication.contacts.imported",
      entityType: "CommunicationImportBatch",
      entityId: batch.id,
      actorUserId: user.id,
      // Safe summary only — never the contact list itself.
      metadata: {
        sourceType: source,
        ...counts,
        imported: createdIds.length,
        consentSource: hasConsent(consentApplied) ? consentSourceLabel(dto) : null,
        consentApplied: { ...consentApplied },
      },
    });

    return { batchId: batch.id, importedCount: createdIds.length, listId, tagIds, consentApplied, ...counts };
  }

  // ---- internals ----

  private assertSize(content: string): void {
    if (Buffer.byteLength(content, "utf8") > IMPORT_MAX_BYTES) {
      throw new BadRequestException(`Import content exceeds the ${Math.round(IMPORT_MAX_BYTES / (1024 * 1024))} MB limit.`);
    }
  }

  private country(dto: { defaultCountry?: string }): CountryCode {
    return dto.defaultCountry && isSupportedCountry(dto.defaultCountry) ? dto.defaultCountry : "US";
  }

  /** Parse + validate + classify every row. Purely computes; never mutates the DB. */
  private async process(dto: ImportPreviewDto): Promise<{ rows: ProcessedRow[]; counts: ImportCounts }> {
    this.assertSize(dto.content);
    const raw = this.parseRaw(dto);
    if (raw.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(`Import exceeds the ${IMPORT_MAX_ROWS.toLocaleString()} row limit. Split the file and try again.`);
    }
    const country = this.country(dto);
    const attestEmail = dto.consent?.email === true;
    const attestSms = dto.consent?.sms === true;

    // First pass: normalize + row-level validity.
    const rows: ProcessedRow[] = raw.map((r, i) => {
      const emailVal = r.email && r.email.trim() ? toEmailValue(r.email) : null;
      const phoneVal = r.phone && r.phone.trim() ? toPhoneValue(r.phone, country) : null;
      const emailInvalid = !!(r.email && r.email.trim()) && !emailVal;
      const phoneInvalid = !!(r.phone && r.phone.trim()) && !phoneVal;

      let status: ImportRowStatus = "NEW";
      let issue: string | null = null;
      if (emailInvalid) {
        status = "INVALID";
        issue = "Invalid email format";
      } else if (phoneInvalid) {
        status = "INVALID";
        issue = "Invalid phone number";
      } else if (!emailVal && !phoneVal) {
        status = "INVALID";
        issue = "No email or phone";
      }
      return {
        row: i + 1,
        firstName: r.firstName?.trim() || null,
        lastName: r.lastName?.trim() || null,
        email: emailVal?.display ?? (r.email?.trim() || null),
        phone: phoneVal?.display ?? (r.phone?.trim() || null),
        organization: r.organization?.trim() || null,
        emailConsent: emailVal ? resolveImportConsent(parseConsentCell(r.emailConsent), attestEmail) : null,
        smsConsent: phoneVal ? resolveImportConsent(parseConsentCell(r.smsConsent), attestSms) : null,
        status,
        issue,
        normalizedEmail: emailVal?.normalized ?? null,
        normalizedPhoneE164: phoneVal?.e164 ?? null,
      };
    });

    // Existing-contact lookup + suppression flags for the valid rows only.
    const valid = rows.filter((r) => r.status !== "INVALID");
    const emails = [...new Set(valid.map((r) => r.normalizedEmail).filter((x): x is string => !!x))];
    const phones = [...new Set(valid.map((r) => r.normalizedPhoneE164).filter((x): x is string => !!x))];
    const lookup = await this.buildLookup(emails, phones);
    const suppressed = await this.suppressions.flagsFor(emails, phones);

    // Second pass: within-batch dedupe → suppression → DB duplicate/conflict.
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    for (const r of rows) {
      if (r.status === "INVALID") continue;
      const dupInBatch = (r.normalizedEmail && seenEmails.has(r.normalizedEmail)) || (r.normalizedPhoneE164 && seenPhones.has(r.normalizedPhoneE164));
      if (dupInBatch) {
        r.status = "DUPLICATE";
        r.issue = "Duplicate within this import";
      } else if ((r.normalizedEmail && suppressed.emails.has(r.normalizedEmail)) || (r.normalizedPhoneE164 && suppressed.phones.has(r.normalizedPhoneE164))) {
        r.status = "SUPPRESSED";
        r.issue = "Address is suppressed";
      } else {
        const match = classifyContactMatch(r, lookup);
        if (match.status === "CONFLICT") {
          r.status = "CONFLICT";
          r.issue = "Email and phone match two different existing contacts";
        } else if (match.status === "DUPLICATE") {
          r.status = "DUPLICATE";
          r.issue = "Already exists";
        } else {
          r.status = "NEW";
          r.issue = null;
        }
      }
      if (r.normalizedEmail) seenEmails.add(r.normalizedEmail);
      if (r.normalizedPhoneE164) seenPhones.add(r.normalizedPhoneE164);
    }

    // Recording an opt-in needs to say how that consent was collected; an
    // opt-out read from the file needs no justification.
    const recordsOptIn = rows.some((r) => r.status !== "INVALID" && (r.emailConsent === "OPTED_IN" || r.smsConsent === "OPTED_IN"));
    if (recordsOptIn && !dto.consent?.source?.trim()) {
      throw new BadRequestException("Say how consent was collected before importing contacts as opted in.");
    }

    const counts: ImportCounts = {
      total: rows.length,
      new: rows.filter((r) => r.status === "NEW").length,
      duplicate: rows.filter((r) => r.status === "DUPLICATE").length,
      invalid: rows.filter((r) => r.status === "INVALID").length,
      conflict: rows.filter((r) => r.status === "CONFLICT").length,
      suppressed: rows.filter((r) => r.status === "SUPPRESSED").length,
    };
    return { rows, counts };
  }

  private parseRaw(dto: ImportPreviewDto): RawRow[] {
    if (dto.sourceType === "CSV") {
      const parsed = parseCsvContent(dto.content);
      const m = dto.mapping ?? {};
      if (m.email === undefined && m.phone === undefined) {
        throw new BadRequestException("Map at least an Email or Phone column before importing.");
      }
      const at = (cols: string[], idx?: number) => (idx !== undefined ? cols[idx] : undefined);
      return parsed.rows.map((cols) => ({
        firstName: at(cols, m.firstName),
        lastName: at(cols, m.lastName),
        email: at(cols, m.email),
        phone: at(cols, m.phone),
        organization: at(cols, m.organization),
        emailConsent: at(cols, m.emailConsent),
        smsConsent: at(cols, m.smsConsent),
      }));
    }
    // PASTE / TXT: one value per line/token, interpreted as email or phone.
    const values = dto.sourceType === "PASTE" ? splitPasted(dto.content) : parseTxtLines(dto.content);
    const asPhone = dto.mode === "PHONE";
    return values.map((v) => (asPhone ? { phone: v } : { email: v }));
  }

  private async buildLookup(emails: string[], phones: string[]): Promise<ExistingLookup> {
    const emailToContactId = new Map<string, string>();
    const phoneToContactId = new Map<string, string>();
    if (emails.length === 0 && phones.length === 0) return { emailToContactId, phoneToContactId };
    const existing = await this.prisma.communicationContact.findMany({
      where: { OR: [{ normalizedEmail: { in: emails } }, { normalizedPhoneE164: { in: phones } }] },
      select: { id: true, normalizedEmail: true, normalizedPhoneE164: true },
    });
    for (const c of existing) {
      if (c.normalizedEmail) emailToContactId.set(c.normalizedEmail, c.id);
      if (c.normalizedPhoneE164) phoneToContactId.set(c.normalizedPhoneE164, c.id);
    }
    return { emailToContactId, phoneToContactId };
  }

  private async insertNewContacts(user: RequestUser, newRows: ProcessedRow[], source: CommunicationContactSource): Promise<string[]> {
    if (newRows.length === 0) return [];
    for (const chunk of chunked(newRows, CHUNK)) {
      await this.prisma.communicationContact.createMany({
        data: chunk.map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          normalizedEmail: r.normalizedEmail,
          phone: r.phone,
          normalizedPhoneE164: r.normalizedPhoneE164,
          organizationName: r.organization,
          source,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        })),
        skipDuplicates: true,
      });
    }
    // Resolve ids (whether we created them or a concurrent import did) for prefs/lists/tags.
    const emails = newRows.map((r) => r.normalizedEmail).filter((x): x is string => !!x);
    const phones = newRows.map((r) => r.normalizedPhoneE164).filter((x): x is string => !!x);
    const created = await this.prisma.communicationContact.findMany({
      where: { OR: [{ normalizedEmail: { in: emails } }, { normalizedPhoneE164: { in: phones } }] },
      select: { id: true, normalizedEmail: true, normalizedPhoneE164: true },
    });
    const ids: string[] = [];
    const prefData: Array<{ contactId: string; channel: CommunicationChannel }> = [];
    for (const c of created) {
      ids.push(c.id);
      if (c.normalizedEmail) prefData.push({ contactId: c.id, channel: "EMAIL" });
      if (c.normalizedPhoneE164) prefData.push({ contactId: c.id, channel: "SMS" });
    }
    for (const chunk of chunked(prefData, CHUNK)) {
      await this.prisma.contactChannelPreference.createMany({ data: chunk, skipDuplicates: true });
    }
    return ids;
  }

  /**
   * Records the consent the import carries on the contacts it matched. Rows
   * naming the same address are merged first (an opt-out among them wins), then
   * each is compared with what is on file: an opt-in only fills UNKNOWN.
   */
  private async applyConsent(user: RequestUser, rows: ProcessedRow[], source: string): Promise<ImportConsentCounts> {
    const applied = emptyConsentCounts();
    const wanted = new Map<string, ExplicitConsent>();
    const merge = (key: string, value: ExplicitConsent | null) => {
      if (!value) return;
      if (wanted.get(key) !== "OPTED_OUT") wanted.set(key, value);
    };
    for (const r of rows) {
      if (r.normalizedEmail) merge(`EMAIL:${r.normalizedEmail}`, r.emailConsent);
      if (r.normalizedPhoneE164) merge(`SMS:${r.normalizedPhoneE164}`, r.smsConsent);
    }
    if (wanted.size === 0) return applied;

    const emails = [...wanted.keys()].filter((k) => k.startsWith("EMAIL:")).map((k) => k.slice(6));
    const phones = [...wanted.keys()].filter((k) => k.startsWith("SMS:")).map((k) => k.slice(4));
    const contacts = await this.prisma.communicationContact.findMany({
      where: { OR: [...(emails.length ? [{ normalizedEmail: { in: emails } }] : []), ...(phones.length ? [{ normalizedPhoneE164: { in: phones } }] : [])] },
      select: { id: true, normalizedEmail: true, normalizedPhoneE164: true, preferences: { select: { id: true, channel: true, consentStatus: true } } },
    });

    // Group writes by (channel, status) so each group is one statement.
    const updates = new Map<string, string[]>();
    const creates: Array<{ contactId: string; channel: CommunicationChannel; status: ExplicitConsent }> = [];
    for (const c of contacts) {
      for (const channel of ["EMAIL", "SMS"] as const) {
        const address = channel === "EMAIL" ? c.normalizedEmail : c.normalizedPhoneE164;
        const next = address ? wanted.get(`${channel}:${address}`) : undefined;
        if (!next) continue;
        const pref = c.preferences.find((p) => p.channel === channel);
        if (!mayApplyConsent(pref?.consentStatus, next)) continue;
        if (pref) {
          const key = `${channel}:${next}`;
          updates.set(key, [...(updates.get(key) ?? []), pref.id]);
        } else {
          creates.push({ contactId: c.id, channel, status: next });
        }
        applied[counterKey(channel, next)] += 1;
      }
    }

    const now = new Date();
    for (const [key, ids] of updates) {
      const status = key.split(":")[1] as ExplicitConsent;
      for (const chunk of chunked(ids, CHUNK)) {
        await this.prisma.contactChannelPreference.updateMany({
          where: { id: { in: chunk } },
          data: { ...consentFields(status, source, now), updatedByUserId: user.id },
        });
      }
    }
    for (const chunk of chunked(creates, CHUNK)) {
      await this.prisma.contactChannelPreference.createMany({
        data: chunk.map((c) => ({ contactId: c.contactId, channel: c.channel, ...consentFields(c.status, source, now), updatedByUserId: user.id })),
        skipDuplicates: true,
      });
    }
    return applied;
  }

  private async updateEmptyFields(duplicateRows: ProcessedRow[]): Promise<void> {
    const emails = duplicateRows.map((r) => r.normalizedEmail).filter((x): x is string => !!x);
    const phones = duplicateRows.map((r) => r.normalizedPhoneE164).filter((x): x is string => !!x);
    if (emails.length === 0 && phones.length === 0) return;
    const existing = await this.prisma.communicationContact.findMany({
      where: { OR: [{ normalizedEmail: { in: emails } }, { normalizedPhoneE164: { in: phones } }] },
    });
    const byEmail = new Map(existing.filter((c) => c.normalizedEmail).map((c) => [c.normalizedEmail!, c]));
    const byPhone = new Map(existing.filter((c) => c.normalizedPhoneE164).map((c) => [c.normalizedPhoneE164!, c]));
    for (const r of duplicateRows) {
      const target = (r.normalizedEmail && byEmail.get(r.normalizedEmail)) || (r.normalizedPhoneE164 && byPhone.get(r.normalizedPhoneE164));
      if (!target) continue;
      const data: Record<string, string> = {};
      if (!target.firstName && r.firstName) data.firstName = r.firstName;
      if (!target.lastName && r.lastName) data.lastName = r.lastName;
      if (!target.organizationName && r.organization) data.organizationName = r.organization;
      // Never overwrite an existing populated channel; only fill an empty one.
      if (!target.normalizedEmail && r.normalizedEmail && r.email) {
        data.email = r.email;
        data.normalizedEmail = r.normalizedEmail;
      }
      if (!target.normalizedPhoneE164 && r.normalizedPhoneE164 && r.phone) {
        data.phone = r.phone;
        data.normalizedPhoneE164 = r.normalizedPhoneE164;
      }
      if (Object.keys(data).length > 0) {
        await this.prisma.communicationContact.update({ where: { id: target.id }, data }).catch(() => undefined);
      }
    }
  }
}

interface RawRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  emailConsent?: string;
  smsConsent?: string;
}

function strip(r: ProcessedRow): ImportRowResult {
  return {
    row: r.row,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    organization: r.organization,
    emailConsent: r.emailConsent,
    smsConsent: r.smsConsent,
    status: r.status,
    issue: r.issue,
  };
}

function emptyConsentCounts(): ImportConsentCounts {
  return { emailOptedIn: 0, emailOptedOut: 0, smsOptedIn: 0, smsOptedOut: 0 };
}

function counterKey(channel: CommunicationChannel, status: ExplicitConsent): keyof ImportConsentCounts {
  return `${channel === "EMAIL" ? "email" : "sms"}${status === "OPTED_IN" ? "OptedIn" : "OptedOut"}`;
}

/** What the import asks to record, over the rows it will actually touch. */
function countConsent(rows: ProcessedRow[]): ImportConsentCounts {
  const counts = emptyConsentCounts();
  for (const r of rows) {
    if (r.status !== "NEW" && r.status !== "DUPLICATE") continue;
    if (r.emailConsent) counts[counterKey("EMAIL", r.emailConsent)] += 1;
    if (r.smsConsent) counts[counterKey("SMS", r.smsConsent)] += 1;
  }
  return counts;
}

function hasConsent(c: ImportConsentCounts): boolean {
  return c.emailOptedIn + c.emailOptedOut + c.smsOptedIn + c.smsOptedOut > 0;
}

/** Stored on each preference so anyone reading a contact sees where its consent came from. */
function consentSourceLabel(dto: ImportPreviewDto): string {
  const source = dto.consent?.source?.trim();
  return source ? `Import: ${source}` : "Import file";
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
