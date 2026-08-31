import { describe, expect, it } from "vitest";
import { activeLabel, activeTone, blogStatusLabel, blogStatusTone } from "./content-status";
import { visibleNav } from "./navigation";
import { PERMISSIONS } from "./permissions";

describe("content status helpers", () => {
  it("labels and tones blog statuses", () => {
    expect(blogStatusLabel("DRAFT")).toBe("Draft");
    expect(blogStatusLabel("PUBLISHED")).toBe("Published");
    expect(blogStatusLabel("ARCHIVED")).toBe("Archived");
    expect(blogStatusTone("PUBLISHED")).toBe("positive");
    expect(blogStatusTone("DRAFT")).toBe("neutral");
    expect(blogStatusTone("ARCHIVED")).toBe("warning");
  });

  it("labels and tones active state", () => {
    expect(activeLabel(true)).toBe("Active");
    expect(activeLabel(false)).toBe("Inactive");
    expect(activeTone(true)).toBe("positive");
    expect(activeTone(false)).toBe("neutral");
  });
});

describe("content navigation", () => {
  it("shows the Content group only with content.read", () => {
    const withPerm = visibleNav([PERMISSIONS.CONTENT_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(withPerm).toEqual(expect.arrayContaining(["Blog", "Short Videos", "Testimonials"]));

    const without = visibleNav([PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(without).not.toContain("Blog");
    expect(without).not.toContain("Testimonials");
  });
});
