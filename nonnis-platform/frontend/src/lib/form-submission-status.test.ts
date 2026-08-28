import { describe, expect, it } from "vitest";
import { submissionStatusLabel, submissionStatusTone } from "./form-submission-status";
import { visibleNav } from "./navigation";
import { PERMISSIONS } from "./permissions";

describe("form submission status", () => {
  it("labels statuses", () => {
    expect(submissionStatusLabel("NEW")).toBe("New");
    expect(submissionStatusLabel("IN_REVIEW")).toBe("In Review");
    expect(submissionStatusLabel("RESOLVED")).toBe("Resolved");
    expect(submissionStatusLabel("ARCHIVED")).toBe("Archived");
  });

  it("maps statuses to tones", () => {
    expect(submissionStatusTone("NEW")).toBe("info");
    expect(submissionStatusTone("IN_REVIEW")).toBe("warning");
    expect(submissionStatusTone("RESOLVED")).toBe("positive");
    expect(submissionStatusTone("ARCHIVED")).toBe("neutral");
  });
});

describe("form submissions navigation", () => {
  it("shows Form Submissions only with form_submissions.read", () => {
    const withPerm = visibleNav([PERMISSIONS.FORM_SUBMISSIONS_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(withPerm).toContain("Form Submissions");
    const without = visibleNav([PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(without).not.toContain("Form Submissions");
  });
});
