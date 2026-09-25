import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EmailTransport, OutboundEmailMessage } from "../communications/providers/email-transport";
import { InvoiceEmailService } from "./invoice-email.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import type { PaymentGateway } from "./payment-gateway";
import type { InvoiceView } from "./invoices.serializer";

function invoice(over: Partial<InvoiceView> = {}): InvoiceView {
  return {
    id: "63fd861c-fed3-4857-899f-0de3ebef6ee8",
    invoiceNumber: "INV-2026-ABC123",
    provider: { id: "provider-a", name: "Sunrise Home", email: "billing@sunrise.test" },
    caseId: null,
    orderId: null,
    status: "APPROVED",
    billingType: "ONE_TIME",
    paymentMethod: "ZELLE",
    issueDate: "2026-09-01T00:00:00.000Z",
    dueDate: "2026-09-30T00:00:00.000Z",
    currency: "USD",
    subtotal: "4000.00",
    taxRate: "0.0000",
    taxAmount: "0.00",
    totalAmount: "4000.00",
    amountPaid: "0.00",
    amountDue: "4000.00",
    notes: null,
    hasStripeSession: false,
    recurringInterval: null,
    recurringPeriods: null,
    recurringStartAt: null,
    recurringEndsAt: null,
    sentAt: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    items: [{ id: "i1", name: "Private-pay placement fee", description: null, quantity: "2.00", unitPrice: "2000.00", lineTotal: "4000.00", position: 0 }],
    payments: [],
    events: [{ id: "e1", type: "approved", fromStatus: "DRAFT", toStatus: "APPROVED", message: "Approved by Jane Admin", createdAt: "2026-09-01T00:00:00.000Z" }],
    ...over,
  };
}

function build(opts: { ok?: boolean; gatewayConfigured?: boolean; sender?: string | undefined } = {}) {
  const sent: OutboundEmailMessage[] = [];
  const transport = {
    name: "mock",
    configured: true,
    configurationError: null,
    sendEmail: jest.fn().mockImplementation((m: OutboundEmailMessage) => {
      sent.push(m);
      return Promise.resolve(
        opts.ok === false
          ? { ok: false as const, classification: "PERMANENT" as const, code: "REJECTED", message: "Recipient rejected." }
          : { ok: true as const, providerMessageId: "prov-1", acceptedAt: new Date().toISOString() },
      );
    }),
  } as unknown as EmailTransport;

  const gateway = { configured: opts.gatewayConfigured ?? false } as unknown as PaymentGateway;
  const config = {
    get: (key: string) => {
      if (key === "frontendUrl") return "https://admin.nonnisplacement.com";
      if (key === "mailFrom") return "sender" in opts ? opts.sender : "billing@nonnisplacement.com";
      if (key === "communicationsApiUrl") return "https://api.nonnisplacement.com";
      if (key === "invoicePaymentLinkSecret") return "a-long-server-side-secret-value";
      return undefined;
    },
  } as unknown as ConfigService<never, true>;

  const svc = new InvoiceEmailService(transport, gateway, new InvoicePdfService(), config);
  return { svc, transport, sent };
}

describe("InvoiceEmailService", () => {
  it("emails the provider with the number, amount and due date", async () => {
    const { svc, sent } = build();
    const out = await svc.send(invoice());

    expect(out.sent).toBe(true);
    const m = sent[0]!;
    expect(m.to).toBe("billing@sunrise.test");
    expect(m.subject).toContain("INV-2026-ABC123");
    for (const body of [m.html, m.text]) {
      expect(body).toContain("INV-2026-ABC123");
      expect(body).toContain("4000.00");
      expect(body).toContain("2026-09-30");
    }
  });

  it("attaches the PDF rather than only linking to it", async () => {
    const { svc, sent } = build();
    await svc.send(invoice());
    const attachment = sent[0]!.attachments?.[0];
    expect(attachment?.fileName).toBe("INV-2026-ABC123.pdf");
    expect(attachment?.mimeType).toBe("application/pdf");
    expect(Buffer.from(attachment!.contentBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("links to the provider portal, not an admin screen", async () => {
    const { svc, sent } = build();
    await svc.send(invoice());
    expect(sent[0]!.html).toContain("/provider/invoices/63fd861c-fed3-4857-899f-0de3ebef6ee8");
    expect(sent[0]!.html).not.toContain("/admin/");
  });

  it("never leaks the approver, the event history, or internal ids", async () => {
    // The invoice's own status IS included — that is a stated requirement. What
    // must not travel is who approved it, what happened before, and our ids.
    const { svc, sent } = build();
    await svc.send(invoice({ notes: null }));
    const body = `${sent[0]!.html}${sent[0]!.text}`;
    expect(body).not.toContain("Jane Admin");
    expect(body).not.toContain("fromStatus");
    expect(body).not.toContain("provider-a");
    expect(body).not.toContain("caseId");
  });

  it("gives manual payment instructions when no processor is connected", async () => {
    const { svc, sent } = build({ gatewayConfigured: false });
    await svc.send(invoice({ paymentMethod: "ZELLE" }));
    expect(sent[0]!.text).toMatch(/zelle/i);
  });

  it("offers no card link at all while Stripe is off, and still says how to pay", async () => {
    // Silence beats a dead button: a provider who cannot pay by card should be
    // shown the way that does work, not one that fails on the click.
    const { svc, sent } = build({ gatewayConfigured: false });
    await svc.send(invoice({ paymentMethod: "STRIPE" }));
    const body = `${sent[0]!.html}${sent[0]!.text}`;
    expect(body).not.toContain("checkout.stripe.com");
    expect(body).not.toContain("/invoice-payments/");
    expect(body).not.toMatch(/pay by card/i);
    expect(body).toMatch(/zelle/i);
  });

  it("escapes provider-supplied text rather than injecting it into the HTML", async () => {
    const { svc, sent } = build();
    await svc.send(invoice({ items: [{ id: "i1", name: '<script>alert(1)</script>', description: null, quantity: "1.00", unitPrice: "1.00", lineTotal: "1.00", position: 0 }] }));
    expect(sent[0]!.html).not.toContain("<script>");
    expect(sent[0]!.html).toContain("&lt;script&gt;");
  });

  it("refuses when the provider has no billing email rather than reporting a phantom send", async () => {
    const { svc, transport } = build();
    await expect(svc.send(invoice({ provider: { id: "p", name: "No Email Home", email: null } }))).rejects.toBeInstanceOf(BadRequestException);
    expect(transport.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses when no sending address is configured", async () => {
    const { svc, transport } = build({ sender: undefined });
    await expect(svc.send(invoice())).rejects.toBeInstanceOf(BadRequestException);
    expect(transport.sendEmail).not.toHaveBeenCalled();
  });

  it("reports a rejected send instead of claiming success", async () => {
    const { svc } = build({ ok: false });
    const out = await svc.send(invoice());
    expect(out.sent).toBe(false);
    expect(out.reason).toContain("rejected");
  });
});

describe("the invoice email offers both ways to pay", () => {
  it("shows a card button and the Zelle details side by side", async () => {
    const { svc, sent } = build({ gatewayConfigured: true });
    await svc.send(invoice());
    const body = `${sent[0]!.html}${sent[0]!.text}`;

    expect(body).toMatch(/pay by card/i);
    expect(body).toMatch(/pay by zelle/i);
    expect(body).toContain("Nonni&#39;s Placement Services LLC");
  });

  it("names the Zelle recipient in words, not only in an image a client may block", async () => {
    // A blocked QR must still leave the provider able to pay.
    const { svc, sent } = build({ gatewayConfigured: true });
    await svc.send(invoice());
    expect(sent[0]!.text).toContain("Nonni's Placement Services LLC");
    expect(sent[0]!.text).toContain("/51094.jpg");
  });

  it("links to Nonni's own payment route, never to an expiring Stripe session", async () => {
    // A Checkout session dies within a day. This email has to still work in
    // three weeks, so the link comes back here and a session is made on click.
    const { svc, sent } = build({ gatewayConfigured: true });
    await svc.send(invoice());
    const body = `${sent[0]!.html}${sent[0]!.text}`;

    expect(body).toContain("https://api.nonnisplacement.com/invoice-payments/");
    expect(body).not.toContain("checkout.stripe.com");
  });

  it("offers both however Nonni's recorded the method when raising the bill", async () => {
    // paymentMethod is Nonni's own expectation. It must not take the card
    // option away from the provider, who chooses when the invoice arrives.
    for (const paymentMethod of ["ZELLE", "STRIPE"]) {
      const { svc, sent } = build({ gatewayConfigured: true });
      await svc.send(invoice({ paymentMethod }));
      const body = `${sent[0]!.html}${sent[0]!.text}`;
      expect(body).toMatch(/pay by card/i);
      expect(body).toMatch(/pay by zelle/i);
    }
  });

  it("puts a different link in every send, so two emails share no token", async () => {
    const link = async () => {
      const { svc, sent } = build({ gatewayConfigured: true });
      await svc.send(invoice());
      return /invoice-payments\/([A-Za-z0-9_-]+)/.exec(sent[0]!.text)?.[1];
    };
    const [a, b] = [await link(), await link()];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("never puts the invoice id in the payment link", async () => {
    const { svc, sent } = build({ gatewayConfigured: true });
    await svc.send(invoice());
    const token = /invoice-payments\/([A-Za-z0-9_-]+)/.exec(sent[0]!.text)![1];
    expect(token).not.toContain("63fd861c");
  });

  it("still offers Zelle on an invoice whose card option is off", async () => {
    const { svc, sent } = build({ gatewayConfigured: false });
    await svc.send(invoice());
    expect(sent[0]!.text).toMatch(/pay by zelle/i);
  });
});
