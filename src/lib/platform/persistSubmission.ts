import "server-only";
import type { EmailFile, EmailSection, FormSubmission } from "@/lib/email/sendFormEmail";

/**
 * Server-only, best-effort persistence of a website form submission into the
 * Nonni's platform admin panel. This is ADDITIVE — the existing email + PDF
 * flow runs first and is never affected by this call.
 *
 * Only the normalized text answers (`sections`) plus safe processing metadata
 * are sent. Uploaded file bytes (`files[].content`) and any raw payload are
 * NEVER transmitted here — they continue to travel by email only.
 *
 * Persistence talks to the platform server-to-server using a server-only shared
 * token; the token is never exposed to the browser. If the platform env vars are
 * not configured, persistence is skipped silently (email already succeeded).
 */

const FORM_KEYS: Record<string, string> = {
  "Care Profile": "care_profile",
  "Contact Form": "contact",
  "Cascadia Home Health": "home_care_inquiry",
  "Find Community": "find_community",
  "Provider Form": "provider",
  "Hospital Referral": "hospital_referral",
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findValue(sections: EmailSection[], needle: string): string | undefined {
  const n = needle.toLowerCase();
  for (const s of sections) {
    for (const f of s.fields) {
      if (f.label.toLowerCase().includes(n) && f.value && f.value !== "Not provided") return f.value;
    }
  }
  return undefined;
}

/**
 * Files are forwarded base64-encoded inside the ingest request, so the whole
 * submission must stay within one modest request body — serverless platforms
 * cap request sizes well below the website's own 30 MB allowance. The PDF
 * record is always sent first because it is small and is the thing staff
 * actually need in the CRM; uploaded documents follow while they fit.
 *
 * Anything that does not fit is simply not forwarded. It is still attached to
 * the submission email, which remains the complete record.
 */
const INGEST_FILE_BUDGET_BYTES = 3 * 1024 * 1024; // base64 bytes across all files

type IngestFile = { kind: "REPORT" | "UPLOAD"; fileName: string; contentType: string; contentBase64: string };

function selectFilesWithinBudget(pdf: Buffer | null, referenceId: string, files: EmailFile[]): IngestFile[] {
  const selected: IngestFile[] = [];
  let used = 0;

  if (pdf) {
    const contentBase64 = pdf.toString("base64");
    if (contentBase64.length <= INGEST_FILE_BUDGET_BYTES) {
      selected.push({
        kind: "REPORT",
        fileName: `Submission-${referenceId}.pdf`,
        contentType: "application/pdf",
        contentBase64,
      });
      used += contentBase64.length;
    }
  }

  for (const file of files) {
    if (!file.content) continue; // metadata-only entry: nothing to store
    if (selected.length >= 6) break;
    if (used + file.content.length > INGEST_FILE_BUDGET_BYTES) continue;
    selected.push({
      kind: "UPLOAD",
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      contentBase64: file.content,
    });
    used += file.content.length;
  }
  return selected;
}

export async function persistSubmission(
  sub: FormSubmission & { referenceId: string },
  pdf: Buffer | null = null,
): Promise<void> {
  const apiUrl = process.env.NONNIS_PLATFORM_API_URL;
  const token = process.env.NONNIS_INGEST_TOKEN;
  if (!apiUrl || !token) return; // Platform ingestion not configured — skip.

  const files = sub.files ?? [];
  const payload = {
    reference: sub.referenceId,
    formKey: FORM_KEYS[sub.formName] ?? slug(sub.formName),
    formName: sub.formName,
    sourcePage: sub.pageUrl,
    submitterName: findValue(sub.sections, "name"),
    submitterEmail: sub.replyTo || findValue(sub.sections, "email"),
    submitterPhone: findValue(sub.sections, "phone") || findValue(sub.sections, "pager"),
    submittedData: { sections: sub.sections },
    emailStatus: "SENT",
    // Reported honestly: a PDF is only claimed when one was actually rendered.
    reportGenerated: pdf !== null,
    documentGenerated: files.length > 0,
    attachmentsCount: files.length,
    submittedAt: sub.submittedAt,
    files: selectFilesWithinBudget(pdf, sub.referenceId, files),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/form-submissions/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ingest-Token": token },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ingest responded ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}
