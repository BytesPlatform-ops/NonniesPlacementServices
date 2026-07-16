/**
 * Frontend form-submit helper. Every form on the site posts to the same
 * serverless endpoint (`/api/forms/submit`), which emails a full, readable
 * submission to the admin inbox. Forms build grouped, human-readable
 * `sections` plus a `raw` object (for the debug JSON block) and call this.
 *
 * No email/SMTP logic lives here or in any form — only in the server route.
 */

export type SubmissionFile = { name: string; size: number; type: string };
export type SubmissionFieldItem = { label: string; value: string };
export type SubmissionSection = { title: string; fields: SubmissionFieldItem[] };

export type SubmitFormPayload = {
  /** Human name used in the subject line, e.g. "Care Profile". */
  formName: string;
  /** Grouped, human-readable field groups shown in the email body. */
  sections: SubmissionSection[];
  /** Raw submitted values — appended as a JSON block so nothing is ever lost. */
  raw: Record<string, unknown>;
  /** Submitter's email, used as the email Reply-To when present. */
  replyTo?: string;
  /** Optional source/label in addition to the auto-captured page URL. */
  source?: string;
  /** Uploaded document metadata (name/size/type). */
  files?: SubmissionFile[];
  /** Anti-spam honeypot value — must be empty for a real human. */
  honeypot?: string;
};

/**
 * Read the honeypot value from a form submit event (no refs needed). Bots that
 * auto-fill the hidden `company` input get caught server-side.
 */
export function readHoneypot(event?: { target?: unknown } | null): string {
  const form = event?.target;
  if (typeof HTMLFormElement !== "undefined" && form instanceof HTMLFormElement) {
    const el = form.querySelector('input[name="company"]') as HTMLInputElement | null;
    return el?.value ?? "";
  }
  return "";
}

/** Format any value into a readable string for the email. */
export function fieldValue(value: unknown): string {
  if (value === undefined || value === null) return "Not provided";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const s = String(value).trim();
  return s === "" ? "Not provided" : s;
}

/** Build a {label, value} pair with value formatting. */
export function field(label: string, value: unknown): SubmissionFieldItem {
  return { label, value: fieldValue(value) };
}

/** Resolve a select/radio slug to its human label (falls back to the raw value). */
export function optionLabel(options: { value: string; label: string }[], value: string | undefined): string {
  if (!value) return "Not provided";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Resolve an array of slugs to their human labels. */
export function optionLabels(options: { value: string; label: string }[], values: string[] | undefined): string[] {
  if (!values?.length) return [];
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v);
}

/**
 * POST the submission to the shared endpoint. Throws on a non-2xx response so
 * callers can show the error state and keep the user's entered data.
 */
export async function submitForm(payload: SubmitFormPayload): Promise<void> {
  const res = await fetch("/api/forms/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      submittedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Form submit failed (${res.status})`);
}
