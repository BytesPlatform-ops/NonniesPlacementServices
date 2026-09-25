import { Prisma } from "@prisma/client";
import { amountDue, calculateInvoiceTotals, isFullySettled, recurringEndsAt } from "./invoice-totals";

const dec = (v: string | number) => new Prisma.Decimal(v);

describe("calculateInvoiceTotals — money never becomes a float", () => {
  it("multiplies a line and sums the subtotal", () => {
    const t = calculateInvoiceTotals([{ quantity: 2, unitPrice: "2000.00" }]);
    expect(t.lines[0]!.lineTotal.toFixed(2)).toBe("4000.00");
    expect(t.subtotal.toFixed(2)).toBe("4000.00");
    expect(t.totalAmount.toFixed(2)).toBe("4000.00");
  });

  it("adds several lines", () => {
    const t = calculateInvoiceTotals([
      { quantity: 2, unitPrice: "2000.00" },
      { quantity: 1, unitPrice: "349.99" },
      { quantity: 3, unitPrice: "12.05" },
    ]);
    expect(t.lines.map((l) => l.lineTotal.toFixed(2))).toEqual(["4000.00", "349.99", "36.15"]);
    expect(t.subtotal.toFixed(2)).toBe("4386.14");
  });

  it("survives the arithmetic binary floating point gets wrong", () => {
    // 0.1 + 0.2 !== 0.3 as a JS number; as Decimal it must be exact.
    const t = calculateInvoiceTotals([
      { quantity: 1, unitPrice: "0.10" },
      { quantity: 1, unitPrice: "0.20" },
    ]);
    expect(t.subtotal.toFixed(2)).toBe("0.30");

    // 1.005 rounds to 1.01 half-up; as a float it rounds DOWN to 1.00.
    const r = calculateInvoiceTotals([{ quantity: 1, unitPrice: "1.005" }]);
    expect(r.lines[0]!.lineTotal.toFixed(2)).toBe("1.01");
  });

  it("rounds each line before summing, so the column adds up to the total", () => {
    // Three lines of 0.005 each: rounding at the end would give 0.02, but the
    // printed lines each read 0.01, and 0.01 × 3 is what a reader will add.
    const t = calculateInvoiceTotals([
      { quantity: 1, unitPrice: "0.005" },
      { quantity: 1, unitPrice: "0.005" },
      { quantity: 1, unitPrice: "0.005" },
    ]);
    expect(t.lines.map((l) => l.lineTotal.toFixed(2))).toEqual(["0.01", "0.01", "0.01"]);
    expect(t.subtotal.toFixed(2)).toBe("0.03");
  });

  it("applies tax to the subtotal", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: "100.00" }], "0.0825");
    expect(t.taxAmount.toFixed(2)).toBe("8.25");
    expect(t.totalAmount.toFixed(2)).toBe("108.25");
  });

  it("treats no tax as no tax rather than as an error", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: "100.00" }]);
    expect(t.taxAmount.toFixed(2)).toBe("0.00");
    expect(t.totalAmount.toFixed(2)).toBe("100.00");
  });

  it("handles fractional quantities", () => {
    const t = calculateInvoiceTotals([{ quantity: "1.50", unitPrice: "200.00" }]);
    expect(t.lines[0]!.lineTotal.toFixed(2)).toBe("300.00");
  });

  it("totals an empty invoice to zero rather than NaN", () => {
    const t = calculateInvoiceTotals([]);
    expect(t.subtotal.toFixed(2)).toBe("0.00");
    expect(t.totalAmount.toFixed(2)).toBe("0.00");
  });
});

describe("amountDue / isFullySettled", () => {
  it("reports what is still owed", () => {
    expect(amountDue(dec("4000.00"), dec("1500.00")).toFixed(2)).toBe("2500.00");
  });

  it("clamps an overpayment at zero instead of showing a negative balance", () => {
    expect(amountDue(dec("100.00"), dec("150.00")).toFixed(2)).toBe("0.00");
  });

  it("is settled only when the money covers the invoice", () => {
    expect(isFullySettled(dec("100.00"), dec("100.00"))).toBe(true);
    expect(isFullySettled(dec("100.00"), dec("99.99"))).toBe(false);
    expect(isFullySettled(dec("100.00"), dec("150.00"))).toBe(true);
  });

  it("does not call a zero invoice settled by an absence of payment", () => {
    expect(isFullySettled(dec("0.00"), dec("0.00"))).toBe(false);
  });
});

describe("recurringEndsAt — Stripe cannot stop after N periods by itself", () => {
  it("ends two monthly periods after the start", () => {
    const end = recurringEndsAt(new Date("2026-01-01T00:00:00Z"), 2, "MONTHLY");
    expect(end.toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("clamps a month rollover instead of skipping into the next month", () => {
    // 31 Jan + 1 month must land in February, not on 2/3 March.
    const end = recurringEndsAt(new Date("2026-01-31T00:00:00Z"), 1, "MONTHLY");
    expect(end.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("refuses a plan with no billing periods", () => {
    expect(() => recurringEndsAt(new Date(), 0, "MONTHLY")).toThrow();
  });
});
