import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "../communications/providers/email-transport";
import { InvoicePdfService, type InvoicePaymentInstructions } from "./invoice-pdf.service";
import { mintPaymentToken, paymentLinkUrl } from "./payment-link";
import { zelleInstructions } from "./zelle";
import type { InvoiceView } from "./invoices.serializer";
import { PAYMENT_GATEWAY, type PaymentGateway } from "./payment-gateway";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}



/**
 * The invoice email a provider actually receives.
 *
 * Deliberately minimal and deliberately incomplete: it carries the figures and
 * a link, not the whole record. Anything a provider needs to act on is in the
 * portal behind their own login, and internal notes, approver names and event
 * history never leave the building.
 *
 * The PDF is attached rather than linked so the email is useful on its own,
 * and it is rendered from the same record the portal shows — there is only ever
 * one version of an invoice.
 */
@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger("InvoiceEmail");

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly pdf: InvoicePdfService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Send one approved invoice to its provider.
   *
   * Refuses without a billing address rather than reporting a send that never
   * happened — "sent" has to mean somebody received something.
   */
  async send(invoice: InvoiceView): Promise<{ sent: boolean; reason?: string }> {
    if (!invoice.provider.email) {
      throw new BadRequestException(
        `${invoice.provider.name} has no billing email on file. Add one to the provider profile before sending this invoice.`,
      );
    }

    const senderEmail = this.config.get("mailFrom", { infer: true }) ?? this.config.get("brevoSenderEmail", { infer: true });
    if (!senderEmail) {
      throw new BadRequestException("No sending address is configured, so the invoice cannot be emailed.");
    }

    const base = this.config.get("frontendUrl", { infer: true }).replace(/\/$/, "");
    const link = `${base}/provider/invoices/${invoice.id}`;
    const pay = this.instructions(invoice);
    const pdf = await this.pdf.render(invoice, pay);

    const outcome = await this.transport.sendEmail({
      internalMessageId: `invoice-${invoice.id}-${Date.now()}`,
      to: invoice.provider.email,
      toName: invoice.provider.name,
      senderEmail,
      senderName: "Nonni's Placement Services",
      subject: `Invoice ${invoice.invoiceNumber} from Nonni's Placement Services`,
      html: this.html(invoice, link, pay),
      text: this.text(invoice, link, pay),
      tags: ["invoice"],
      attachments: [
        {
          fileName: `${invoice.invoiceNumber}.pdf`,
          mimeType: "application/pdf",
          contentBase64: pdf.toString("base64"),
        },
      ],
    });

    if (!outcome.ok) {
      // The provider-neutral message only; never the raw provider payload.
      this.logger.error(`Invoice ${invoice.invoiceNumber} could not be emailed: ${outcome.message}`);
      return { sent: false, reason: outcome.message };
    }
    return { sent: true };
  }

  /**
   * The two ways this invoice can be settled.
   *
   * Both are offered whenever both are available, because how to pay is the
   * provider's decision — Nonni's raising the invoice does not make it. The
   * card link is Nonni's own URL, not a Stripe one: a Checkout session dies
   * within a day, and this email has to still work in three weeks.
   */
  private instructions(invoice: InvoiceView): InvoicePaymentInstructions {
    const token = this.gateway.configured ? mintPaymentToken(this.config, invoice.id) : null;
    const zelle = zelleInstructions(this.config);
    return { cardUrl: token ? paymentLinkUrl(this.config, token) : null, zelleRecipient: zelle.recipient, zelleQrUrl: zelle.qrUrl };
  }

  private text(invoice: InvoiceView, link: string, pay: InvoicePaymentInstructions): string {
    const lines = [
      `Invoice ${invoice.invoiceNumber} from Nonni's Placement Services`,
      "",
      `Amount due: ${invoice.currency} ${invoice.amountDue}`,
      `Total: ${invoice.currency} ${invoice.totalAmount}`,
      `Due date: ${shortDate(invoice.dueDate)}`,
      `Status: ${invoice.status.replace(/_/g, " ").toLowerCase()}`,
      "",
      "HOW TO PAY — choose whichever suits you.",
      "",
    ];
    if (pay.cardUrl) {
      lines.push("Pay by card:", pay.cardUrl, "");
    }
    lines.push(
      "Pay by Zelle:",
      `Send to ${pay.zelleRecipient} from your banking app, then tell us from your provider portal.`,
      `QR code: ${pay.zelleQrUrl}`,
      "",
    );
    lines.push(`View this invoice: ${link}`, "", "The invoice is attached as a PDF.");
    return lines.join("\n");
  }

  private html(invoice: InvoiceView, link: string, pay: InvoicePaymentInstructions): string {
    const rows = invoice.items
      .map(
        (i) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #EDE8DC;color:#24211D;">${escapeHtml(i.name)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #EDE8DC;text-align:right;color:#6B645A;">${escapeHtml(i.quantity)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #EDE8DC;text-align:right;color:#6B645A;">${escapeHtml(i.unitPrice)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #EDE8DC;text-align:right;color:#24211D;">${escapeHtml(i.lineTotal)}</td>
          </tr>`,
      )
      .join("");

    return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;color:#24211D;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#8A5A2B;">Nonni&#39;s Placement Services</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6B645A;">Invoice ${escapeHtml(invoice.invoiceNumber)}</p>

      <div style="background:#FFFFFF;border:1px solid #DED8C9;border-radius:4px;padding:20px;">
        <p style="margin:0 0 4px;font-size:13px;color:#6B645A;">Amount due</p>
        <p style="margin:0 0 16px;font-size:26px;font-weight:bold;">${escapeHtml(invoice.currency)} ${escapeHtml(invoice.amountDue)}</p>
        <p style="margin:0 0 20px;font-size:13px;color:#6B645A;">Due ${escapeHtml(shortDate(invoice.dueDate))}</p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;padding-bottom:6px;font-size:11px;color:#6B645A;">DESCRIPTION</th>
              <th style="text-align:right;padding-bottom:6px;font-size:11px;color:#6B645A;">QTY</th>
              <th style="text-align:right;padding-bottom:6px;font-size:11px;color:#6B645A;">UNIT</th>
              <th style="text-align:right;padding-bottom:6px;font-size:11px;color:#6B645A;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="margin:16px 0 0;text-align:right;font-size:15px;font-weight:bold;">
          Total ${escapeHtml(invoice.currency)} ${escapeHtml(invoice.totalAmount)}
        </p>
      </div>

      <div style="margin:20px 0;padding:16px;background:#FFFFFF;border:1px solid #DED8C9;border-radius:4px;">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.06em;color:#6B645A;">HOW TO PAY</p>
        ${
          pay.cardUrl
            ? `<p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#24211D;">Pay by card</p>
        <p style="margin:0 0 16px;">
          <a href="${escapeHtml(pay.cardUrl)}" style="display:inline-block;background:#8A5A2B;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;">
            Pay ${escapeHtml(invoice.currency)} ${escapeHtml(invoice.amountDue)} by card
          </a>
        </p>`
            : ""
        }
        <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#24211D;">Pay by Zelle</p>
        <p style="margin:0 0 10px;font-size:13px;color:#24211D;">
          Send to <strong>${escapeHtml(pay.zelleRecipient)}</strong> from your banking app, then tell us from your provider portal.
        </p>
        <!-- Many clients block remote images, so the words above stand on their
             own and the QR is an extra rather than the instruction. -->
        <img src="${escapeHtml(pay.zelleQrUrl)}" alt="Zelle QR code for ${escapeHtml(pay.zelleRecipient)}" width="150"
             style="display:block;border:1px solid #DED8C9;border-radius:4px;" />
      </div>

      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;border:1px solid #8A5A2B;color:#8A5A2B;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;">
          View invoice
        </a>
      </p>

      <p style="margin:0;font-size:12px;color:#6B645A;">
        The invoice is attached as a PDF. Sign in to your provider portal to see its full payment history.
      </p>
    </div>
  </body>
</html>`;
  }
}
