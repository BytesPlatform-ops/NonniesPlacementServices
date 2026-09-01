import type { ConfigService } from "@nestjs/config";
import { findReplyToken, formatReplyAddress, parseReplyToken } from "./reply-address";

const config = { get: (k: string) => (k === "communicationsInboundEmailDomain" ? "reply.nonnis.com" : undefined) } as unknown as ConfigService<never, true>;

describe("reply-address", () => {
  it("formats a reply address with the reply- prefix and configured domain", () => {
    expect(formatReplyAddress(config, "abc123DEF456ghi789")).toBe("reply-abc123DEF456ghi789@reply.nonnis.com");
  });

  it("round-trips a token through format → parse (casing + base64url chars preserved)", () => {
    const token = "Ab0-_Cd9zzTOKEN12345"; // 20 chars, base64url alphabet
    const addr = formatReplyAddress(config, token);
    expect(parseReplyToken(config, addr)).toBe(token);
  });

  it("rejects a token on the wrong domain", () => {
    expect(parseReplyToken(config, "reply-abcdef0123456789@evil.com")).toBeNull();
  });

  it("rejects an address without the reply- prefix", () => {
    expect(parseReplyToken(config, "support@reply.nonnis.com")).toBeNull();
  });

  it("rejects a too-short / malformed token", () => {
    expect(parseReplyToken(config, "reply-short@reply.nonnis.com")).toBeNull();
    expect(parseReplyToken(config, "garbage")).toBeNull();
    expect(parseReplyToken(config, null)).toBeNull();
  });

  it("finds the token among many destination addresses (To/Cc/Recipients/ReplyTo)", () => {
    const token = "0123456789abcdefXYZ";
    const found = findReplyToken(config, ["person@gmail.com", "cc@example.com", formatReplyAddress(config, token), null]);
    expect(found).toBe(token);
  });

  it("never derives a token from a raw email / id (only the opaque local part)", () => {
    expect(parseReplyToken(config, "contact-uuid@reply.nonnis.com")).toBeNull();
  });
});
