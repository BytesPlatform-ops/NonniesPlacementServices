import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { addMonthsUtc, fromMinorUnits, normalizeEvent, toMinorUnits } from "./stripe-payment-gateway";

const dec = (v: string) => new Prisma.Decimal(v);

describe("money conversion — never through a float", () => {
  it("converts to Stripe minor units exactly", () => {
    expect(toMinorUnits(dec("500.00"))).toBe(50000);
    expect(toMinorUnits(dec("0.01"))).toBe(1);
    expect(toMinorUnits(dec("4349.99"))).toBe(434999);
  });

  it("survives the values binary floating point gets wrong", () => {
    // 1234.55 * 100 is 123454.999… as a JS number.
    expect(toMinorUnits(dec("1234.55"))).toBe(123455);
    expect(toMinorUnits(dec("8.29"))).toBe(829);
  });

  it("converts back to Decimal without losing cents", () => {
    expect(fromMinorUnits(50000)!.toFixed(2)).toBe("500.00");
    expect(fromMinorUnits(1)!.toFixed(2)).toBe("0.01");
    expect(fromMinorUnits(null)).toBeNull();
  });
});

describe("addMonthsUtc — a fixed-length plan needs an explicit end", () => {
  it("advances whole months", () => {
    expect(addMonthsUtc(new Date("2026-09-01T00:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("clamps a rollover instead of skipping a month", () => {
    expect(addMonthsUtc(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

function checkoutEvent(type: string, session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return { type, data: { object: session } } as unknown as Stripe.Event;
}

describe("normalizeEvent — Snapshot payloads only", () => {
  it("reads a paid session", () => {
    const out = normalizeEvent(
      checkoutEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", amount_total: 50000 }),
    );
    expect(out).toEqual({ kind: "succeeded", sessionId: "cs_1", paymentIntentId: "pi_1", subscriptionId: null, amount: expect.anything(), rawStatus: "paid" });
    expect(out!.amount!.toFixed(2)).toBe("500.00");
  });

  it("ignores a completed session whose payment is still pending", () => {
    // `completed` fires for delayed methods too; payment_status is what decides.
    expect(normalizeEvent(checkoutEvent("checkout.session.completed", { id: "cs_1", payment_status: "unpaid" }))).toBeNull();
  });

  it("handles an expanded payment_intent object as well as an id", () => {
    const out = normalizeEvent(
      checkoutEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid", payment_intent: { id: "pi_2" } as Stripe.PaymentIntent, amount_total: 100 }),
    );
    expect(out!.paymentIntentId).toBe("pi_2");
  });

  it("reads a failed and an expired session as failures", () => {
    for (const type of ["checkout.session.async_payment_failed", "checkout.session.expired"]) {
      const out = normalizeEvent(checkoutEvent(type, { id: "cs_1", status: "expired" }));
      expect(out!.kind).toBe("failed");
    }
  });

  it("ignores an unrelated event rather than guessing at it", () => {
    expect(normalizeEvent({ type: "customer.created", data: { object: {} } } as unknown as Stripe.Event)).toBeNull();
  });
});
