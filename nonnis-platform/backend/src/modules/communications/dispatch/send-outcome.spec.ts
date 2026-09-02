import { classifySendResult } from "./send-outcome";
import type { EmailSendOutcome } from "../providers/email-transport";

const ok: EmailSendOutcome = { ok: true, providerMessageId: "pm1", acceptedAt: "now" };

describe("classifySendResult (shared campaign + reply policy)", () => {
  it("maps a success to 'sent'", () => {
    expect(classifySendResult(ok, 0)).toEqual({ kind: "sent", providerMessageId: "pm1", acceptedAt: "now" });
  });

  it("maps an ambiguous timeout to 'unknown' (never blind-retry)", () => {
    const r = classifySendResult({ ok: false, classification: "AMBIGUOUS", code: "TIMEOUT", message: "t" }, 0);
    expect(r.kind).toBe("unknown");
  });

  it("retries a transient failure below the cap, with backoff", () => {
    const r = classifySendResult({ ok: false, classification: "TEMPORARY", code: "5XX", message: "t" }, 0);
    expect(r).toMatchObject({ kind: "retry", attempt: 1 });
  });

  it("gives up permanently once the attempt cap is reached", () => {
    const r = classifySendResult({ ok: false, classification: "TEMPORARY", code: "5XX", message: "t" }, 2);
    expect(r.kind).toBe("failed");
  });

  it("never retries a permanent failure", () => {
    const r = classifySendResult({ ok: false, classification: "PERMANENT", code: "BOUNCE", message: "t" }, 0);
    expect(r.kind).toBe("failed");
  });

  it("honours a provider retry-after for rate limiting", () => {
    const r = classifySendResult({ ok: false, classification: "RATE_LIMIT", code: "429", message: "t", retryAfterMs: 1234 }, 0);
    expect(r).toMatchObject({ kind: "retry", backoffMs: 1234 });
  });
});
