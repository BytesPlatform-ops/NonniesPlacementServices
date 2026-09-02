import { calculateSegments, isGsm7, MAX_SMS_BODY_CHARS } from "./sms-segments";

describe("SMS encoding detection", () => {
  it("treats plain ASCII and the GSM basic set as GSM-7", () => {
    expect(isGsm7("Hello from Nonni's Placement!")).toBe(true);
    expect(isGsm7("Prix: 10£ @ café")).toBe(true); // £ and é are in the GSM basic set
  });
  it("falls back to UCS-2 for characters outside GSM-7", () => {
    expect(isGsm7("Hello 😀")).toBe(false);
    expect(isGsm7("Ελληνικά κείμενο")).toBe(false);
    expect(isGsm7("Smart ’quote’")).toBe(false); // curly quotes are NOT GSM-7
  });
});

describe("GSM-7 segmentation", () => {
  it("fits 160 characters in a single segment", () => {
    const r = calculateSegments("a".repeat(160));
    expect(r).toMatchObject({ encoding: "GSM7", encodedCharacterUnits: 160, segmentCount: 1, multiSegment: false });
    expect(r.charactersRemainingCurrentSegment).toBe(0);
  });
  it("splits at 161 characters using the 153-character concatenated capacity", () => {
    expect(calculateSegments("a".repeat(161))).toMatchObject({ segmentCount: 2, multiSegment: true, segmentCapacity: 153 });
  });
  it("uses exactly two segments at 306 and three at 307", () => {
    expect(calculateSegments("a".repeat(306)).segmentCount).toBe(2);
    expect(calculateSegments("a".repeat(307)).segmentCount).toBe(3);
  });
  it("counts GSM extended-table characters as two septets (ESC + char)", () => {
    const r = calculateSegments("€");
    expect(r.encoding).toBe("GSM7");
    expect(r.characterCount).toBe(1);
    expect(r.encodedCharacterUnits).toBe(2);
    // 80 euro signs = 160 septets = still one segment.
    expect(calculateSegments("€".repeat(80))).toMatchObject({ encodedCharacterUnits: 160, segmentCount: 1 });
    // 81 tips it over into a concatenated message.
    expect(calculateSegments("€".repeat(81)).segmentCount).toBe(2);
  });
  it("counts every documented extended character as two units", () => {
    for (const ch of ["^", "{", "}", "\\", "[", "~", "]", "|", "€"]) {
      expect(calculateSegments(ch).encodedCharacterUnits).toBe(2);
    }
  });
  it("never splits an escape pair across a segment boundary", () => {
    // 306 units, but the euro pair cannot straddle the 153-unit boundary, so the
    // packed answer (3) is correctly higher than a naive ceil(306 / 153) = 2.
    const r = calculateSegments("a".repeat(152) + "€" + "a".repeat(152));
    expect(r.encodedCharacterUnits).toBe(306);
    expect(r.segmentCount).toBe(3);
    expect(Math.ceil(306 / 153)).toBe(2); // what a naive calculator would report
  });
});

describe("UCS-2 segmentation", () => {
  it("fits 70 characters in a single segment", () => {
    const r = calculateSegments("ю".repeat(70));
    expect(r).toMatchObject({ encoding: "UCS2", encodedCharacterUnits: 70, segmentCount: 1, multiSegment: false });
  });
  it("splits at 71 characters using the 67-character concatenated capacity", () => {
    expect(calculateSegments("ю".repeat(71))).toMatchObject({ segmentCount: 2, segmentCapacity: 67 });
  });
  it("counts a surrogate pair (emoji) as one character but two code units", () => {
    const r = calculateSegments("😀");
    expect(r).toMatchObject({ encoding: "UCS2", characterCount: 1, encodedCharacterUnits: 2, segmentCount: 1 });
  });
  it("never splits a surrogate pair across a segment boundary", () => {
    // 134 units, but the emoji's surrogate pair cannot straddle the 67-unit
    // boundary, so the packed answer (3) beats a naive ceil(134 / 67) = 2.
    const r = calculateSegments("ю".repeat(66) + "😀" + "ю".repeat(66));
    expect(r.encodedCharacterUnits).toBe(134);
    expect(r.segmentCount).toBe(3);
    expect(Math.ceil(134 / 67)).toBe(2); // what a naive calculator would report
  });
});

describe("edge cases", () => {
  it("reports zero segments for an empty body", () => {
    expect(calculateSegments("")).toMatchObject({ segmentCount: 0, multiSegment: false });
  });
  it("exposes the provider body limit", () => {
    expect(MAX_SMS_BODY_CHARS).toBe(1600);
  });
  it("reports remaining capacity in the current segment", () => {
    expect(calculateSegments("a".repeat(150)).charactersRemainingCurrentSegment).toBe(10);
  });
});
