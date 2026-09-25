import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { InvoiceView } from "./invoices.serializer";

/** Nonni's palette, matching the product's own umber/sage identity. */
const INK = "#2B2621";
const MUTED = "#6E675C";
const RULE = "#DED8C9";
const BRAND = "#8A5A2B";

const PAGE_MARGIN = 50;

function money(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** What a reader of this invoice can do about paying it. */
export interface InvoicePaymentInstructions {
  /** Nonni's own durable pay-by-card link, or null when cards are unavailable. */
  cardUrl: string | null;
  /** Who a Zelle payment should be sent to. */
  zelleRecipient: string;
  /** Where the QR can be seen. A printed page cannot show a scannable one. */
  zelleQrUrl: string;
}

/**
 * Renders an invoice to PDF.
 *
 * Every figure is read from the invoice record it is handed. Nothing is
 * recomputed here and nothing is stored: the database row is the invoice, and
 * this is a view of it. A PDF that did its own arithmetic would eventually
 * disagree with the record it claims to represent.
 */
@Injectable()
export class InvoicePdfService {
  /**
   * The whole document as a Buffer, ready to stream or attach to an email.
   *
   * `payment` is what the reader can actually do about the bill. It is optional
   * because an admin downloading a copy has no use for it; when it is supplied
   * the document carries both ways to pay, and the card link is Nonni's own
   * durable URL — never a Stripe session, which would be dead within a day of
   * the PDF being filed.
   */
  async render(invoice: InvoiceView, payment?: InvoicePaymentInstructions): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, info: { Title: `Invoice ${invoice.invoiceNumber}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    this.header(doc, invoice);
    this.parties(doc, invoice);
    const afterItems = this.items(doc, invoice);
    this.totals(doc, invoice, afterItems);
    if (payment && invoice.status !== "PAID" && invoice.status !== "CANCELLED") this.howToPay(doc, payment);
    this.footer(doc, invoice);

    doc.end();
    return done;
  }

  private header(doc: PDFKit.PDFDocument, invoice: InvoiceView): void {
    doc.fillColor(BRAND).fontSize(20).font("Helvetica-Bold").text("Nonni's Placement Services", PAGE_MARGIN, PAGE_MARGIN);
    doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("Placement and provider services");

    const right = doc.page.width - PAGE_MARGIN - 200;
    doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text("INVOICE", right, PAGE_MARGIN, { width: 200, align: "right" });
    doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(invoice.invoiceNumber, right, doc.y, { width: 200, align: "right" });

    doc.moveDown(1.5);
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).strokeColor(RULE).stroke();
    doc.moveDown(1);
  }

  private parties(doc: PDFKit.PDFDocument, invoice: InvoiceView): void {
    const top = doc.y;
    const colWidth = (doc.page.width - PAGE_MARGIN * 2) / 2 - 10;

    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("BILLED TO", PAGE_MARGIN, top);
    doc.fillColor(INK).fontSize(11).font("Helvetica").text(invoice.provider.name, PAGE_MARGIN, doc.y + 2, { width: colWidth });
    if (invoice.provider.email) {
      doc.fillColor(MUTED).fontSize(9).text(invoice.provider.email, { width: colWidth });
    }

    const right = PAGE_MARGIN + colWidth + 20;
    const rows: Array<[string, string]> = [
      ["Issue date", shortDate(invoice.issueDate)],
      ["Due date", shortDate(invoice.dueDate)],
      ["Status", statusLabel(invoice.status)],
      ["Payment method", statusLabel(invoice.paymentMethod)],
    ];
    if (invoice.billingType === "RECURRING") {
      rows.push(["Billing", `Monthly × ${invoice.recurringPeriods ?? "—"}`]);
    }

    let y = top;
    for (const [label, value] of rows) {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(label, right, y, { width: colWidth * 0.5 });
      doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(value, right + colWidth * 0.5, y, { width: colWidth * 0.5, align: "right" });
      y += 14;
    }

    doc.y = Math.max(doc.y, y) + 16;
  }

  /** The line-item table. Returns the y position just below it. */
  private items(doc: PDFKit.PDFDocument, invoice: InvoiceView): number {
    const left = PAGE_MARGIN;
    const width = doc.page.width - PAGE_MARGIN * 2;
    const cols = { name: left, qty: left + width * 0.55, unit: left + width * 0.68, total: left + width * 0.84 };
    const colWidth = width * 0.16;

    let y = doc.y;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
    doc.text("DESCRIPTION", cols.name, y);
    doc.text("QTY", cols.qty, y, { width: colWidth, align: "right" });
    doc.text("UNIT PRICE", cols.unit, y, { width: colWidth, align: "right" });
    doc.text("AMOUNT", cols.total, y, { width: colWidth, align: "right" });

    y += 14;
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor(RULE).stroke();
    y += 8;

    for (const item of invoice.items) {
      // A long description must not run under the numbers, so the row's height
      // follows the text rather than being assumed.
      const nameHeight = doc.fontSize(10).font("Helvetica").heightOfString(item.name, { width: width * 0.5 });
      doc.fillColor(INK).fontSize(10).font("Helvetica").text(item.name, cols.name, y, { width: width * 0.5 });
      let rowHeight = nameHeight;
      if (item.description) {
        doc.fillColor(MUTED).fontSize(8).text(item.description, cols.name, y + nameHeight + 1, { width: width * 0.5 });
        rowHeight += doc.heightOfString(item.description, { width: width * 0.5 }) + 1;
      }

      doc.fillColor(INK).fontSize(10).font("Helvetica");
      doc.text(item.quantity, cols.qty, y, { width: colWidth, align: "right" });
      doc.text(item.unitPrice, cols.unit, y, { width: colWidth, align: "right" });
      doc.text(item.lineTotal, cols.total, y, { width: colWidth, align: "right" });

      y += Math.max(rowHeight, 14) + 8;
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
    }

    doc.moveTo(left, y).lineTo(left + width, y).strokeColor(RULE).stroke();
    return y + 12;
  }

  private totals(doc: PDFKit.PDFDocument, invoice: InvoiceView, top: number): void {
    const width = doc.page.width - PAGE_MARGIN * 2;
    const labelX = PAGE_MARGIN + width * 0.55;
    const valueX = PAGE_MARGIN + width * 0.78;
    const valueWidth = width * 0.22;

    let y = top;
    const line = (label: string, value: string, bold = false) => {
      doc.fillColor(bold ? INK : MUTED).fontSize(bold ? 11 : 9).font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, labelX, y, { width: width * 0.23 });
      doc.text(value, valueX, y, { width: valueWidth, align: "right" });
      y += bold ? 18 : 14;
    };

    line("Subtotal", money(invoice.subtotal, invoice.currency));
    // Only shown when tax actually applies — a 0.00 line invites the question
    // "why is there tax on this?" on an invoice that has none.
    if (invoice.taxAmount !== "0.00") {
      line(`Tax (${(Number(invoice.taxRate) * 100).toFixed(2)}%)`, money(invoice.taxAmount, invoice.currency));
    }
    doc.moveTo(labelX, y).lineTo(PAGE_MARGIN + width, y).strokeColor(RULE).stroke();
    y += 8;
    line("Total", money(invoice.totalAmount, invoice.currency), true);

    if (invoice.amountPaid !== "0.00") {
      line("Paid", `- ${money(invoice.amountPaid, invoice.currency)}`);
      line("Amount due", money(invoice.amountDue, invoice.currency), true);
    }

    doc.y = y + 20;
  }

  /**
   * The two ways to settle this invoice, side by side.
   *
   * Both are shown whenever both are available: which one a provider uses is
   * their decision, not something the invoice decides for them. The card link
   * is printed in full as well as linked, because a PDF is read on paper as
   * often as on screen.
   */
  private howToPay(doc: PDFKit.PDFDocument, payment: InvoicePaymentInstructions): void {
    const width = doc.page.width - PAGE_MARGIN * 2;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("HOW TO PAY", PAGE_MARGIN, doc.y);
    doc.moveDown(0.4);

    if (payment.cardUrl) {
      doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text("Pay by card", PAGE_MARGIN, doc.y, { width });
      doc
        .fillColor(BRAND)
        .fontSize(9)
        .font("Helvetica")
        .text(payment.cardUrl, PAGE_MARGIN, doc.y + 1, { width, link: payment.cardUrl, underline: true });
      doc.moveDown(0.6);
    }

    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text("Pay by Zelle", PAGE_MARGIN, doc.y, { width });
    doc
      .fillColor(INK)
      .fontSize(9)
      .font("Helvetica")
      .text(`Send to ${payment.zelleRecipient} from your banking app, then tell us from your provider portal.`, PAGE_MARGIN, doc.y + 1, { width });
    // The QR lives on the web rather than on the page: a scannable code needs
    // resolution a 400 KB embed would have to buy on every invoice ever sent.
    doc
      .fillColor(BRAND)
      .fontSize(9)
      .font("Helvetica")
      .text("Scan the QR code", PAGE_MARGIN, doc.y + 1, { width, link: payment.zelleQrUrl, underline: true });
    doc.moveDown(1);
  }

  private footer(doc: PDFKit.PDFDocument, invoice: InvoiceView): void {
    if (invoice.notes) {
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("NOTES", PAGE_MARGIN, doc.y);
      doc.fillColor(INK).fontSize(9).font("Helvetica").text(invoice.notes, PAGE_MARGIN, doc.y + 2, { width: doc.page.width - PAGE_MARGIN * 2 });
      doc.moveDown(1);
    }

    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text(
        invoice.status === "PAID"
          ? `Paid in full. Thank you.`
          : `Please settle by ${shortDate(invoice.dueDate)}. Quote ${invoice.invoiceNumber} with your payment.`,
        PAGE_MARGIN,
        doc.page.height - PAGE_MARGIN - 20,
        { width: doc.page.width - PAGE_MARGIN * 2 },
      );
  }
}
