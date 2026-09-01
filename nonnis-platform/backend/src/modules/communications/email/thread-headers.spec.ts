import { buildReferencesChain, generateInternetMessageId, normalizeReplySubject } from "./thread-headers";

describe("normalizeReplySubject", () => {
  it("adds a single Re: prefix", () => {
    expect(normalizeReplySubject("Hello")).toBe("Re: Hello");
  });
  it("collapses stacked reply prefixes (never Re: Re: Re:)", () => {
    expect(normalizeReplySubject("Re: Re: RE: Fwd hello")).toBe("Re: Fwd hello");
    expect(normalizeReplySubject("AW: hello")).toBe("Re: hello");
  });
  it("handles a blank subject", () => {
    expect(normalizeReplySubject("")).toBe("Re: (no subject)");
    expect(normalizeReplySubject(null)).toBe("Re: (no subject)");
  });
});

describe("buildReferencesChain", () => {
  it("appends the in-reply-to id and de-duplicates", () => {
    expect(buildReferencesChain("<a> <b>", "<b>")).toBe("<a> <b>");
    expect(buildReferencesChain("<a>", "<c>")).toBe("<a> <c>");
  });
  it("returns null when there is nothing to chain", () => {
    expect(buildReferencesChain(null, null)).toBeNull();
  });
  it("bounds the chain, keeping the root + newest tail", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `<m${i}@x>`);
    const chain = buildReferencesChain(ids.join(" "), "<latest@x>")!;
    const parts = chain.split(" ");
    expect(parts.length).toBeLessThanOrEqual(20);
    expect(parts[0]).toBe("<m0@x>"); // root preserved
    expect(parts[parts.length - 1]).toBe("<latest@x>"); // newest preserved
  });
});

describe("generateInternetMessageId", () => {
  it("produces an RFC <uuid@domain> id", () => {
    const id = generateInternetMessageId("reply.nonnis.com");
    expect(id).toMatch(/^<[0-9a-f-]{36}@reply\.nonnis\.com>$/);
  });
  it("falls back to a safe host for an empty domain", () => {
    expect(generateInternetMessageId("")).toMatch(/@nonnis\.local>$/);
  });
});
