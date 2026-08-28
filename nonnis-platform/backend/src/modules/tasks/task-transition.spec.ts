import { canTransitionTask, isTaskEditable, isTaskOverdue } from "./task-transition";

describe("task transitions", () => {
  it("allows open/in-progress to complete or cancel but not reopen", () => {
    expect(canTransitionTask("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransitionTask("OPEN", "COMPLETED")).toBe(true);
    expect(canTransitionTask("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionTask("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionTask("CANCELLED", "OPEN")).toBe(false);
  });

  it("marks only open/in-progress as editable", () => {
    expect(isTaskEditable("OPEN")).toBe(true);
    expect(isTaskEditable("IN_PROGRESS")).toBe(true);
    expect(isTaskEditable("COMPLETED")).toBe(false);
  });

  it("derives overdue from due date and status", () => {
    const past = new Date("2020-01-01T00:00:00Z");
    const future = new Date("2999-01-01T00:00:00Z");
    expect(isTaskOverdue(past, "OPEN")).toBe(true);
    expect(isTaskOverdue(past, "IN_PROGRESS")).toBe(true);
    expect(isTaskOverdue(past, "COMPLETED")).toBe(false);
    expect(isTaskOverdue(future, "OPEN")).toBe(false);
    expect(isTaskOverdue(null, "OPEN")).toBe(false);
  });
});
