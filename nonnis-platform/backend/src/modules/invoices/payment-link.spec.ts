import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";
import { mintPaymentToken, paymentLinkUrl, paymentLinksConfigured, readPaymentToken } from "./payment-link";

const INVOICE = "63fd861c-fed3-4857-899f-0de3ebef6ee8";
const OTHER = "11111111-2222-3333-4444-555555555555";

function cfg(secret: string | undefined, api = "http://localhost:4000"): ConfigService<AppConfig, true> {
  return {
    get: (k: string) => (k === "invoicePaymentLinkSecret" ? secret : k === "communicationsApiUrl" ? api : undefined),
  } as unknown as ConfigService<AppConfig, true>;
}

const SECRET = cfg("a-long-server-side-secret-value");

describe("the payment token seals one invoice and nothing else", () => {
  it("round-trips the invoice it was minted for", () => {
    const token = mintPaymentToken(SECRET, INVOICE)!;
    expect(readPaymentToken(SECRET, token)).toBe(INVOICE);
  });

  it("never puts the invoice id in the link", () => {
    // A reader who can see the id can try it elsewhere. They cannot see it.
    const token = mintPaymentToken(SECRET, INVOICE)!;
    expect(token).not.toContain(INVOICE);
    expect(token).not.toContain(INVOICE.replace(/-/g, ""));
    expect(Buffer.from(token, "base64url").toString("hex")).not.toContain(INVOICE.replace(/-/g, ""));
  });

  it("gives a different token every time, so two links are never comparable", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintPaymentToken(SECRET, INVOICE)));
    expect(seen.size).toBe(50);
  });

  it("opens every one of those tokens to the same invoice", () => {
    for (let i = 0; i < 10; i++) {
      expect(readPaymentToken(SECRET, mintPaymentToken(SECRET, INVOICE)!)).toBe(INVOICE);
    }
  });

  it("refuses a token whose bytes were altered", () => {
    const token = mintPaymentToken(SECRET, INVOICE)!;
    const buf = Buffer.from(token, "base64url");
    buf[buf.length - 3] ^= 0xff; // flip a bit inside the authentication tag
    expect(readPaymentToken(SECRET, buf.toString("base64url"))).toBeNull();
  });

  it("refuses a token whose ciphertext was altered", () => {
    const token = mintPaymentToken(SECRET, INVOICE)!;
    const buf = Buffer.from(token, "base64url");
    buf[14] ^= 0x01; // inside the sealed invoice id
    expect(readPaymentToken(SECRET, buf.toString("base64url"))).toBeNull();
  });

  it("refuses a token minted under a different secret", () => {
    const token = mintPaymentToken(cfg("some-other-secret-entirely"), INVOICE)!;
    expect(readPaymentToken(SECRET, token)).toBeNull();
  });

  it.each([["", "empty"], ["not-a-token", "arbitrary text"], ["YWJj", "too short"], [INVOICE, "the raw invoice id"]])(
    "refuses %s (%s)",
    (token) => {
      expect(readPaymentToken(SECRET, token)).toBeNull();
    },
  );

  it("cannot be steered to another invoice by swapping one token's half into another", () => {
    // The nonce and the sealed body are authenticated together; mixing two
    // tokens produces something that opens to neither invoice.
    const a = Buffer.from(mintPaymentToken(SECRET, INVOICE)!, "base64url");
    const b = Buffer.from(mintPaymentToken(SECRET, OTHER)!, "base64url");
    const spliced = Buffer.concat([a.subarray(0, 12), b.subarray(12)]);
    expect(readPaymentToken(SECRET, spliced.toString("base64url"))).toBeNull();
  });

  it("mints nothing at all when no secret is configured", () => {
    expect(mintPaymentToken(cfg(undefined), INVOICE)).toBeNull();
    expect(paymentLinksConfigured(cfg(undefined))).toBe(false);
    expect(paymentLinksConfigured(SECRET)).toBe(true);
  });

  it("opens nothing when no secret is configured, even for a genuine token", () => {
    const token = mintPaymentToken(SECRET, INVOICE)!;
    expect(readPaymentToken(cfg(undefined), token)).toBeNull();
  });
});

describe("the URL that goes into an email", () => {
  it("points at Nonni's, never at Stripe", () => {
    const url = paymentLinkUrl(SECRET, mintPaymentToken(SECRET, INVOICE)!);
    expect(url).toContain("/invoice-payments/");
    expect(url).not.toContain("stripe.com");
  });

  it("escapes the token so it cannot break out of the path", () => {
    expect(paymentLinkUrl(SECRET, "a/b?c=d")).toContain("a%2Fb%3Fc%3Dd");
  });

  it("does not double a trailing slash on the configured API base", () => {
    expect(paymentLinkUrl(cfg("s", "http://api.test/"), "tok")).toBe("http://api.test/invoice-payments/tok");
  });
});
