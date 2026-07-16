import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Server-only email helper. Formats a form submission into a readable HTML +
 * plain-text email and sends it via Google Workspace SMTP (nodemailer).
 *
 * All SMTP credentials are read from environment variables — nothing is ever
 * hardcoded or shipped to the client (this module is `server-only`).
 */

export type EmailFile = { name: string; size: number; type: string };
export type EmailField = { label: string; value: string };
export type EmailSection = { title: string; fields: EmailField[] };

export type FormSubmission = {
  formName: string;
  pageUrl?: string;
  submittedAt?: string;
  source?: string;
  replyTo?: string;
  sections: EmailSection[];
  files?: EmailFile[];
  raw?: Record<string, unknown>;
};

/** Escape values before injecting into the HTML email. */
function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtBytes(n: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Find the first field value whose label contains `needle` (case-insensitive). */
function findValue(sections: EmailSection[], needle: string): string | undefined {
  const n = needle.toLowerCase();
  for (const s of sections) {
    for (const f of s.fields) {
      if (f.label.toLowerCase().includes(n) && f.value && f.value !== "Not provided") return f.value;
    }
  }
  return undefined;
}

let cached: Transporter | null = null;
function getTransporter(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("Missing SMTP configuration (SMTP_HOST / SMTP_USER / SMTP_PASS).");
  }
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true",
    auth: { user, pass },
  });
  return cached;
}

export async function sendFormEmail(sub: FormSubmission): Promise<void> {
  const to = process.env.FORM_TO || process.env.SMTP_USER;
  const from = process.env.SMTP_USER; // Gmail requires the authenticated user as From
  if (!to || !from) throw new Error("Missing FORM_TO / SMTP_USER.");

  const when = (sub.submittedAt ? new Date(sub.submittedAt) : new Date()).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  });
  const userEmail = sub.replyTo || findValue(sub.sections, "email");
  const userPhone = findValue(sub.sections, "phone") || findValue(sub.sections, "pager");
  const subject = `New ${sub.formName} Submission — Nonni's Placement`;

  /* ---- HTML ---- */
  const summaryRows: [string, string][] = [
    ["Form Name", sub.formName],
    ["Page URL", sub.pageUrl || "—"],
    ["Submitted At", `${when} (PT)`],
    ["User Email", userEmail || "Not provided"],
    ["User Phone", userPhone || "Not provided"],
    ["Source", sub.source || sub.pageUrl || "Website form"],
  ];

  const summaryHtml = summaryRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#5e4a38;font-weight:600;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#2b1b0e">${esc(v)}</td></tr>`,
    )
    .join("");

  const sectionsHtml = sub.sections
    .map((section) => {
      const rows = section.fields
        .map(
          (f) =>
            `<tr><td style="padding:6px 14px 6px 0;color:#5e4a38;font-weight:600;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0e7db">${esc(f.label)}</td><td style="padding:6px 0;color:#2b1b0e;border-bottom:1px solid #f0e7db">${esc(f.value)}</td></tr>`,
        )
        .join("");
      return `<h3 style="margin:22px 0 8px;color:#472e16;font-size:15px">${esc(section.title)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`;
    })
    .join("");

  const filesHtml =
    sub.files && sub.files.length
      ? `<h3 style="margin:22px 0 8px;color:#472e16;font-size:15px">Uploaded Documents</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${sub.files
          .map(
            (f) =>
              `<tr><td style="padding:6px 14px 6px 0;color:#2b1b0e;border-bottom:1px solid #f0e7db">${esc(f.name)}</td><td style="padding:6px 0;color:#5e4a38;border-bottom:1px solid #f0e7db">${esc(fmtBytes(f.size))} · ${esc(f.type || "unknown type")}</td></tr>`,
          )
          .join("")}</table><p style="margin:6px 0 0;font-size:12px;color:#8a7a68">File metadata only — documents are not attached to this email.</p>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#472e16;color:#fff;border-radius:14px 14px 0 0;padding:20px 24px">
        <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#e2b483;font-weight:700">Nonni's Placement Services</div>
        <div style="font-size:20px;font-weight:600;margin-top:2px">New Form Submission</div>
      </div>
      <div style="background:#fff;border:1px solid #eadfce;border-top:0;border-radius:0 0 14px 14px;padding:22px 24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${summaryHtml}</table>
        ${sectionsHtml}
        ${filesHtml}
        <p style="margin:24px 0 0;font-size:12px;color:#8a7a68">This message was generated from the Nonni's website form.</p>
      </div>
    </div>
  </body></html>`;

  /* ---- Plain-text fallback ---- */
  const lines: string[] = [
    "Nonni's Placement Services — New Form Submission",
    "",
    ...summaryRows.map(([k, v]) => `${k}: ${v}`),
    "",
  ];
  for (const section of sub.sections) {
    lines.push(section.title, "-".repeat(section.title.length));
    for (const f of section.fields) lines.push(`- ${f.label}: ${f.value}`);
    lines.push("");
  }
  if (sub.files?.length) {
    lines.push("Uploaded Documents", "-----------------");
    for (const f of sub.files) lines.push(`- ${f.name} (${fmtBytes(f.size)} · ${f.type || "unknown type"})`);
    lines.push("(File metadata only — documents are not attached.)", "");
  }
  lines.push("This message was generated from the Nonni's website form.");
  const text = lines.join("\n");

  await getTransporter().sendMail({
    from: `"Nonni's Placement Website" <${from}>`,
    to,
    replyTo: sub.replyTo || undefined,
    subject,
    text,
    html,
  });
}
