import { stripQuotedReply } from "./strip-quoted-reply";

describe("stripQuotedReply", () => {
  it("keeps only the new text of a Gmail-style reply", () => {
    // This is the exact shape that arrived in production and buried a
    // four-word reply under the whole conversation.
    const raw = [
      "CHECKINGGGGGGGGGGGGGGGG!!!!",
      "",
      "On Fri, Sep 4, 2026 at 3:14 AM Nonni's Placement Services LLC <",
      "admin@nonnisplacement.com> wrote:",
      "",
      "> Check the raw source for a Reply-To header.",
      "> Live email test",
      "> Hello Bytes, this is a live delivery test from the Nonnis CRM.",
    ].join("\n");
    expect(stripQuotedReply(raw)).toBe("CHECKINGGGGGGGGGGGGGGGG!!!!");
  });

  it("handles a single-line attribution", () => {
    const raw = "Sounds good, thanks!\n\nOn Sep 4, 2026, Jane <jane@x.com> wrote:\n> original text";
    expect(stripQuotedReply(raw)).toBe("Sounds good, thanks!");
  });

  it("handles Outlook's original-message separator", () => {
    const raw = "Approved.\n\n-----Original Message-----\nFrom: someone\nEverything below is quoted.";
    expect(stripQuotedReply(raw)).toBe("Approved.");
  });

  it("handles an Outlook From/Sent header block", () => {
    const raw = "Please proceed.\n\nFrom: Nonni's <admin@x.com>\nSent: Friday, September 4, 2026\nSubject: Re: test";
    expect(stripQuotedReply(raw)).toBe("Please proceed.");
  });

  it("strips a trailing quote block that has no attribution line", () => {
    expect(stripQuotedReply("Yes please.\n\n> earlier message\n> more of it")).toBe("Yes please.");
  });

  it("leaves an ordinary message untouched", () => {
    const plain = "Hi there,\n\nWe have three beds available next week.\n\nThanks,\nJane";
    expect(stripQuotedReply(plain)).toBe(plain);
  });

  it("never returns empty when the reply is only a quote", () => {
    // Losing the message entirely would be far worse than showing the quote.
    const onlyQuote = "> the entire message was quoted";
    expect(stripQuotedReply(onlyQuote)).toBe(onlyQuote);
  });

  it("handles missing or blank input", () => {
    expect(stripQuotedReply(null)).toBe("");
    expect(stripQuotedReply(undefined)).toBe("");
    expect(stripQuotedReply("   ")).toBe("");
  });

  it("normalizes CRLF line endings", () => {
    expect(stripQuotedReply("Done.\r\n\r\nOn Sep 4, Jane wrote:\r\n> hi")).toBe("Done.");
  });
});
