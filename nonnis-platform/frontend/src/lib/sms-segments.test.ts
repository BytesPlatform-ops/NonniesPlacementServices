import { describe, expect, it } from "vitest";
import { calculateSegments, isGsm7 } from "./sms-segments";

// These cases mirror the backend sms-segments.spec.ts exactly. If the two
// implementations ever drift, one of these assertions fails first.
describe("sms segment calculator (client mirror of the backend)", () => {
  it("detects GSM-7 vs UCS-2", () => {
    expect(isGsm7("Hello from Nonni's Placement!")).toBe(true);
    expect(isGsm7("Prix: 10£ @ café")).toBe(true);
    expect(isGsm7("Hello 😀")).toBe(false);
    expect(isGsm7("Smart ’quote’")).toBe(false);
  });

  it("applies GSM-7 single and concatenated capacities", () => {
    expect(calculateSegments("a".repeat(160))).toMatchObject({ encoding: "GSM7", segmentCount: 1, multiSegment: false });
    expect(calculateSegments("a".repeat(161))).toMatchObject({ segmentCount: 2, segmentCapacity: 153 });
    expect(calculateSegments("a".repeat(306)).segmentCount).toBe(2);
    expect(calculateSegments("a".repeat(307)).segmentCount).toBe(3);
  });

  it("charges GSM extended characters two septets", () => {
    expect(calculateSegments("€").encodedCharacterUnits).toBe(2);
    expect(calculateSegments("€".repeat(80)).segmentCount).toBe(1);
    expect(calculateSegments("€".repeat(81)).segmentCount).toBe(2);
  });

  it("never splits a two-unit character across a segment boundary", () => {
    expect(calculateSegments("a".repeat(152) + "€" + "a".repeat(152)).segmentCount).toBe(3);
    expect(calculateSegments("ю".repeat(66) + "😀" + "ю".repeat(66)).segmentCount).toBe(3);
  });

  it("applies UCS-2 capacities and counts surrogate pairs correctly", () => {
    expect(calculateSegments("ю".repeat(70))).toMatchObject({ encoding: "UCS2", segmentCount: 1 });
    expect(calculateSegments("ю".repeat(71))).toMatchObject({ segmentCount: 2, segmentCapacity: 67 });
    expect(calculateSegments("😀")).toMatchObject({ characterCount: 1, encodedCharacterUnits: 2, segmentCount: 1 });
  });

  it("reports zero segments for an empty body and remaining capacity otherwise", () => {
    expect(calculateSegments("").segmentCount).toBe(0);
    expect(calculateSegments("a".repeat(150)).charactersRemainingCurrentSegment).toBe(10);
  });
});
