import { describe, expect, it } from "vitest";
import {
  isTaskOverdue,
  messageScopeLabel,
  taskPriorityLabel,
  taskPriorityTone,
  taskStatusLabel,
  taskStatusTone,
} from "./task-status";
import { visibleNav } from "./navigation";
import { PERMISSIONS } from "./permissions";

describe("task status", () => {
  it("labels and tones statuses and priorities", () => {
    expect(taskStatusLabel("IN_PROGRESS")).toBe("In Progress");
    expect(taskStatusTone("COMPLETED")).toBe("positive");
    expect(taskPriorityLabel("URGENT")).toBe("Urgent");
    expect(taskPriorityTone("URGENT")).toBe("negative");
    expect(taskPriorityTone("HIGH")).toBe("warning");
  });

  it("derives overdue", () => {
    expect(isTaskOverdue("2020-01-01T00:00:00Z", "OPEN")).toBe(true);
    expect(isTaskOverdue("2999-01-01T00:00:00Z", "OPEN")).toBe(false);
    expect(isTaskOverdue("2020-01-01T00:00:00Z", "COMPLETED")).toBe(false);
    expect(isTaskOverdue(null, "OPEN")).toBe(false);
  });

  it("labels message scopes", () => {
    expect(messageScopeLabel("CASE_TEAM")).toBe("Case team");
    expect(messageScopeLabel("NONNIS_INTERNAL")).toBe("Nonnis internal");
    expect(messageScopeLabel("PROVIDER_REFERRAL")).toBe("Provider");
  });
});

describe("tasks navigation", () => {
  it("shows Tasks only with tasks.read", () => {
    const withPerm = visibleNav([PERMISSIONS.TASKS_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(withPerm).toContain("Tasks");
    const without = visibleNav([PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(without).not.toContain("Tasks");
  });
});
