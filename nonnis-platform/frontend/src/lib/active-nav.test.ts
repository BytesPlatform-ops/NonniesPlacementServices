import { describe, expect, it } from "vitest";
import { activeNavHref } from "./active-nav";

const STAFF = [
  { href: "/operations" },
  { href: "/operations/form-submissions" },
  { href: "/operations/marketplace" },
  { href: "/notifications" },
  { href: "/cases" },
  { href: "/communications/inbox" },
  { href: "/communications/sms-campaigns" },
];

describe("activeNavHref", () => {
  it("marks the exact route", () => {
    expect(activeNavHref(STAFF, "/cases")).toBe("/cases");
  });

  it("keeps the parent context for a nested route", () => {
    expect(activeNavHref(STAFF, "/cases/abc-123")).toBe("/cases");
    expect(activeNavHref(STAFF, "/communications/inbox/42")).toBe("/communications/inbox");
  });

  it("picks the most specific item when hrefs nest", () => {
    // The bug this rule exists for: a plain prefix test lights both
    // /operations and /operations/marketplace on a marketplace page.
    expect(activeNavHref(STAFF, "/operations/marketplace")).toBe("/operations/marketplace");
    expect(activeNavHref(STAFF, "/operations/marketplace/orders")).toBe("/operations/marketplace");
    expect(activeNavHref(STAFF, "/operations/form-submissions")).toBe("/operations/form-submissions");
  });

  it("still marks the parent when the child is not a navigation item", () => {
    expect(activeNavHref(STAFF, "/operations/tasks")).toBe("/operations");
  });

  it("matches the provider portal root exactly, not its children", () => {
    const provider = [{ href: "/provider" }, { href: "/provider/listings" }, { href: "/provider/coverage" }];
    expect(activeNavHref(provider, "/provider")).toBe("/provider");
    expect(activeNavHref(provider, "/provider/listings")).toBe("/provider/listings");
    // Without the exact rule the portal root would stay lit on every sub-page.
    expect(activeNavHref(provider, "/provider/coverage")).toBe("/provider/coverage");
  });

  it("does not match a sibling that merely shares a prefix string", () => {
    const items = [{ href: "/cases" }];
    // "/cases-archive" is a different route, not a child of "/cases".
    expect(activeNavHref(items, "/cases-archive")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(activeNavHref(STAFF, "/seeker/marketplace")).toBeNull();
  });
});
