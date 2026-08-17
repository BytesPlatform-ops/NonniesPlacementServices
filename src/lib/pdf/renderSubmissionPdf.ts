import "server-only";
import PDFDocument from "pdfkit";
import type { EmailSection, EmailFile } from "@/lib/email/sendFormEmail";

/**
 * Render a form submission into a clean, branded PDF record (returned as a
 * Buffer). Professionally formatted with Nonni's branding, a reference ID,
 * submission timestamp, every submitted field, and a list of uploaded files.
 */

/* Brand palette — mirrors the submission email. */
const BROWN = "#472e16";
const TAN = "#e2b483";
const LABEL = "#5e4a38";
const VALUE = "#2b1b0e";
const HAIRLINE = "#f0e7db";
const MUTED = "#8a7a68";

const PAGE_MARGIN = 50;
const HEADER_H = 92;
const LABEL_W = 168;
const COL_GAP = 16;

export type SubmissionPdfInput = {
  formName: string;
  referenceId: string;
  submittedAtLabel: string;
  summaryRows: [string, string][];
  sections: EmailSection[];
  files?: EmailFile[];
};

function fmtBytes(n: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderSubmissionPdf(input: SubmissionPdfInput): Promise<Buffer> {
  const { formName, referenceId, submittedAtLabel, summaryRows, sections, files } = input;

  const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN; // 562
  const contentW = right - left; // 512
  const bottom = doc.page.height - PAGE_MARGIN; // 742
  const valueX = left + LABEL_W + COL_GAP;
  const valueW = contentW - LABEL_W - COL_GAP;

  let y = 0;

  const ensureSpace = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const drawBrandHeader = () => {
    doc.rect(0, 0, doc.page.width, HEADER_H).fill(BROWN);
    doc
      .fillColor(TAN)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("NONNI'S PLACEMENT SERVICES", left, 24, { characterSpacing: 1.2 });
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(19)
      .text(`${formName} — Submission Record`, left, 42, { width: contentW });
    y = HEADER_H + 22;
  };

  const sectionHeading = (title: string) => {
    ensureSpace(34);
    y += 8;
    doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(12).text(title, left, y, { width: contentW });
    y = doc.y + 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(TAN).lineWidth(1).stroke();
    y += 10;
  };

  const row = (label: string, value: string) => {
    const val = value && value.trim() ? value : "—";
    const labelH = doc.font("Helvetica-Bold").fontSize(9.5).heightOfString(label, { width: LABEL_W, lineGap: 1 });
    const valueH = doc.font("Helvetica").fontSize(10.5).heightOfString(val, { width: valueW, lineGap: 2 });
    const h = Math.max(labelH, valueH);
    ensureSpace(h + 10);
    doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(9.5).text(label, left, y, { width: LABEL_W, lineGap: 1 });
    doc.fillColor(VALUE).font("Helvetica").fontSize(10.5).text(val, valueX, y, { width: valueW, lineGap: 2 });
    y += h + 8;
    doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor(HAIRLINE).lineWidth(0.5).stroke();
  };

  const promise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  /* ---- Build the document ---- */
  drawBrandHeader();

  // Reference ID + submitted-at bar.
  doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(9).text("REFERENCE ID", left, y);
  doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(9).text("SUBMITTED", left + 300, y);
  y += 13;
  doc.fillColor(VALUE).font("Helvetica-Bold").fontSize(13).text(referenceId, left, y, { width: 290 });
  doc.fillColor(VALUE).font("Helvetica").fontSize(11).text(submittedAtLabel, left + 300, y + 1, { width: contentW - 300 });
  y += 26;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(TAN).lineWidth(1).stroke();
  y += 6;

  // Summary.
  sectionHeading("Submission Summary");
  for (const [k, v] of summaryRows) row(k, v);

  // Each grouped section.
  for (const section of sections) {
    sectionHeading(section.title);
    if (!section.fields.length) {
      row("—", "No entries");
      continue;
    }
    for (const f of section.fields) row(f.label, f.value);
  }

  // Uploaded documents.
  sectionHeading("Uploaded Documents");
  if (files && files.length) {
    for (const f of files) row(f.name, `${fmtBytes(f.size)} · ${f.type || "unknown type"}`);
    y += 2;
    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .text(`${files.length} file${files.length === 1 ? "" : "s"} attached to the submission email alongside this record.`, left, y, {
        width: contentW,
      });
    y = doc.y;
  } else {
    row("—", "No documents uploaded");
  }

  // Footer on every page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = doc.page.height - 34;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "Confidential — may contain protected health information. Handle per HIPAA and Nonni's Placement Services data policy.",
        left,
        fy,
        { width: 400 },
      );
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Page ${i + 1} of ${range.count}`, right - 100, fy, { width: 100, align: "right" });
  }

  doc.end();
  return promise;
}
