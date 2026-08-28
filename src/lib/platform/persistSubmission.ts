import "server-only";
import type { EmailSection, FormSubmission } from "@/lib/email/sendFormEmail";

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

export async function persistSubmission(sub: FormSubmission & { referenceId: string }): Promise<void> {
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
    reportGenerated: true,
    documentGenerated: files.length > 0,
    attachmentsCount: files.length,
    submittedAt: sub.submittedAt,
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
