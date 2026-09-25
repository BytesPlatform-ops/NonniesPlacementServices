import { InvoicePdfService } from "./invoice-pdf.service";
import type { InvoiceView } from "./invoices.serializer";

function invoice(over: Partial<InvoiceView> = {}): InvoiceView {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-ABC123",
    provider: { id: "provider-a", name: "Sunrise Home", email: "billing@sunrise.test" },
    caseId: null,
    orderId: null,
    status: "SENT",
    billingType: "ONE_TIME",
    paymentMethod: "BANK_TRANSFER",
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
    items: [
      { id: "i1", name: "Private-pay placement fee", description: null, quantity: "2.00", unitPrice: "2000.00", lineTotal: "4000.00", position: 0 },
    ],
    payments: [],
    events: [],
    ...over,
  };
}

/** PDF bytes contain compressed streams, so assertions are about validity and size. */
describe("InvoicePdfService", () => {
  const svc = new InvoicePdfService();

  it("produces a valid PDF document", async () => {
    const file = await svc.render(invoice());
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    expect(file.subarray(-6).toString()).toContain("EOF");
    expect(file.length).toBeGreaterThan(1000);
  });

  it("renders every line item without truncating the document", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`,
      name: `Service line ${i} with a deliberately long description that must wrap`,
      description: "A second line of detail that also has to wrap without running under the figures.",
      quantity: "1.00",
      unitPrice: "100.00",
      lineTotal: "100.00",
      position: i,
    }));
    const file = await svc.render(invoice({ items: many, subtotal: "4000.00", totalAmount: "4000.00" }));
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    // More content must mean more document; a silent truncation would not.
    const single = await svc.render(invoice());
    expect(file.length).toBeGreaterThan(single.length);
  });

  it("renders a recurring invoice", async () => {
    const file = await svc.render(invoice({ billingType: "RECURRING", recurringInterval: "MONTHLY", recurringPeriods: 2 }));
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a taxed invoice", async () => {
    const file = await svc.render(invoice({ taxRate: "0.0825", taxAmount: "330.00", totalAmount: "4330.00" }));
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a partly paid invoice", async () => {
    const file = await svc.render(invoice({ amountPaid: "1500.00", amountDue: "2500.00", status: "PENDING_PAYMENT" }));
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("survives an invoice with no due date, no notes and no email", async () => {
    const file = await svc.render(invoice({ dueDate: null, notes: null, provider: { id: "p", name: "No Email Home", email: null } }));
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders notes when present", async () => {
    const file = await svc.render(invoice({ notes: "Agreed per the signed provider agreement dated 1 August." }));
    expect(file.length).toBeGreaterThan((await svc.render(invoice())).length);
  });

  it("prints both ways to pay when it is given them", async () => {
    const pay = { cardUrl: "https://api.nonnisplacement.com/invoice-payments/abc123", zelleRecipient: "Nonni's Placement Services LLC", zelleQrUrl: "https://admin.nonnisplacement.com/51094.jpg" };
    const file = await svc.render(invoice({ status: "SENT" }), pay);
    const text = file.toString("latin1");

    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    // The card link is Nonni's own and durable; a Stripe session would be dead
    // long before a filed PDF is opened again.
    expect(text).toContain("invoice-payments");
    expect(text).not.toContain("checkout.stripe.com");
  });

  it("grows when payment instructions are added, so they are really on the page", async () => {
    const plain = await svc.render(invoice({ status: "SENT" }));
    const withPay = await svc.render(invoice({ status: "SENT" }), {
      cardUrl: "https://api.nonnisplacement.com/invoice-payments/abc123",
      zelleRecipient: "Nonni's Placement Services LLC",
      zelleQrUrl: "https://admin.nonnisplacement.com/51094.jpg",
    });
    expect(withPay.length).toBeGreaterThan(plain.length);
  });

  it("still prints the Zelle section when card payment is unavailable", async () => {
    // pdfkit compresses body text, so the words cannot be grepped for; what can
    // be shown is that the section is there and the card link is not.
    const plain = await svc.render(invoice({ status: "SENT" }));
    const zelleOnly = await svc.render(invoice({ status: "SENT" }), {
      cardUrl: null,
      zelleRecipient: "Nonni's Placement Services LLC",
      zelleQrUrl: "https://admin.nonnisplacement.com/51094.jpg",
    });
    expect(zelleOnly.length).toBeGreaterThan(plain.length);
    expect(zelleOnly.toString("latin1")).not.toContain("invoice-payments");
    expect(zelleOnly.toString("latin1")).toContain("51094.jpg");
  });

  it("prints no payment section on an invoice that is already settled", async () => {
    // Nothing to pay, so nothing to offer.
    const paid = await svc.render(invoice({ status: "PAID" }), { cardUrl: "https://x/invoice-payments/t", zelleRecipient: "N", zelleQrUrl: "https://x/51094.jpg" });
    expect(paid.toString("latin1")).not.toContain("invoice-payments");
  });
});
