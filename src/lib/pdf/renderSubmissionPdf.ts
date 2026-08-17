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

/** pdfkit can only embed JPEG and PNG images inline. */
function isEmbeddableImage(f: EmailFile): boolean {
  const t = (f.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/png") return true;
  return /\.(jpe?g|png)$/i.test(f.name);
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

  // Uploaded documents — listed, then image files previewed inline so they can
  // be viewed directly from this PDF (non-image files stay as email attachments).
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
    y = doc.y + 4;

    const previewable = files.filter((f) => f.content && isEmbeddableImage(f));
    const nonPreviewable = files.filter((f) => !isEmbeddableImage(f));
    if (previewable.length) {
      sectionHeading("Uploaded Photos — Preview");
      const colGap = 16;
      const colW = (contentW - colGap) / 2; // two-up grid
      const imgMaxH = 168;
      const capH = 12;
      const cellH = capH + imgMaxH + 16;
      for (let i = 0; i < previewable.length; i += 2) {
        ensureSpace(cellH);
        const rowY = y;
        for (let c = 0; c < 2 && i + c < previewable.length; c++) {
          const f = previewable[i + c];
          const x = left + c * (colW + colGap);
          doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8).text(f.name, x, rowY, {
            width: colW,
            ellipsis: true,
            lineBreak: false,
          });
          try {
            const buf = Buffer.from(f.content as string, "base64");
            doc.image(buf, x, rowY + capH, { fit: [colW, imgMaxH], align: "center" });
          } catch {
            doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text("Preview unavailable — see email attachment.", x, rowY + capH, { width: colW });
          }
        }
        y = rowY + cellH;
      }
    }
    if (nonPreviewable.length) {
      ensureSpace(20);
      doc
        .fillColor(MUTED)
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .text(
          `${nonPreviewable.length} non-image file${nonPreviewable.length === 1 ? "" : "s"} (${nonPreviewable
            .map((f) => f.name)
            .join(", ")}) cannot be previewed inline — open ${nonPreviewable.length === 1 ? "it" : "them"} from the email attachments.`,
          left,
          y,
          { width: contentW },
        );
      y = doc.y + 4;
    }
  } else {
    row("—", "No documents uploaded");
  }

  // Footer on every page. The footer sits below the bottom margin, so zero the
  // margin and disable line-breaking while drawing it — otherwise pdfkit treats
  // the out-of-bounds text as overflow and inserts blank pages.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 34;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "Confidential — may contain protected health information. Handle per HIPAA and Nonni's Placement Services data policy.",
        left,
        fy,
        { width: 400, lineBreak: false },
      );
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Page ${i + 1} of ${range.count}`, right - 100, fy, { width: 100, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return promise;
}
