import { describe, expect, it } from "vitest";
import { priorityClasses, relativeTime } from "./notifications";

describe("priorityClasses", () => {
  it("colours only what is genuinely urgent", () => {
    // Badging every row would make the urgent ones invisible.
    expect(priorityClasses("CRITICAL")).toContain("rose");
    expect(priorityClasses("HIGH")).toContain("amber");
    expect(priorityClasses("NORMAL")).toBeNull();
    expect(priorityClasses("LOW")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("reads naturally at every scale", () => {
    expect(relativeTime("2026-09-14T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-09-14T11:55:00Z", now)).toBe("5 min ago");
    expect(relativeTime("2026-09-14T09:00:00Z", now)).toBe("3 hrs ago");
    expect(relativeTime("2026-09-13T12:00:00Z", now)).toBe("1 day ago");
  });

  it("falls back to a date once relative wording stops helping", () => {
    expect(relativeTime("2026-08-01T12:00:00Z", now)).toMatch(/\d/);
  });

  it("never renders a negative age for a clock that is slightly ahead", () => {
    expect(relativeTime("2026-09-14T12:00:30Z", now)).toBe("just now");
  });

  it("returns nothing for an unparseable timestamp", () => {
    expect(relativeTime("not-a-date", now)).toBe("");
  });
});
