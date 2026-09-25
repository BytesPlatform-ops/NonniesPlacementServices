import { describe, expect, it } from "vitest";
import { providerPaymentChoices } from "./invoice-status";

const READY = { card: true, cardUnavailableReason: null, zelle: true };
const NO_CARD = { card: false, cardUnavailableReason: "No payment processor is connected.", zelle: true };

describe("what a provider is offered", () => {
  it("shows Pay with Stripe on an invoice that has been sent", () => {
    expect(providerPaymentChoices("SENT", READY).card).toBe(true);
  });

  it.each(["SENT", "PENDING_PAYMENT", "OVERDUE"])("shows both options while the invoice is %s", (status) => {
    const c = providerPaymentChoices(status, READY);
    expect(c.card).toBe(true);
    expect(c.zelle).toBe(true);
  });

  it.each(["PAID", "CANCELLED", "DRAFT", "PENDING_REVIEW", "APPROVED"])("offers nothing to pay while the invoice is %s", (status) => {
    const c = providerPaymentChoices(status, READY);
    expect(c.card).toBe(false);
    expect(c.zelle).toBe(false);
  });

  it("keeps bank transfer available while Nonni's is verifying a claimed payment", () => {
    // The provider said they sent it; until that is confirmed the details
    // should still be visible to them.
    const c = providerPaymentChoices("REQUIRES_VERIFICATION", READY);
    expect(c.zelle).toBe(true);
    expect(c.card).toBe(false);
  });

  it("hides the card button when no processor is connected, and says why", () => {
    const c = providerPaymentChoices("SENT", NO_CARD);
    expect(c.card).toBe(false);
    expect(c.cardUnavailableReason).toBe("No payment processor is connected.");
    expect(c.zelle).toBe(true);
  });

  it("explains nothing on an invoice there is no longer anything to pay", () => {
    expect(providerPaymentChoices("PAID", NO_CARD).cardUnavailableReason).toBeNull();
  });

  it("shows no card button before the options have loaded", () => {
    expect(providerPaymentChoices("SENT", null).card).toBe(false);
    expect(providerPaymentChoices("SENT", undefined).card).toBe(false);
  });

  it("takes no account of the method Nonni's recorded on the invoice", () => {
    // The guarantee is structural: there is no parameter for it, so the
    // admin's choice when raising the bill cannot narrow the provider's.
    expect(providerPaymentChoices.length).toBe(2);
  });
});
