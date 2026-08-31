import { describe, expect, it, vi } from "vitest";
import { performAction, type ActionDeps } from "./perform-action";

/** A stand-in for ApiError without importing the browser api-client into a node test. */
const apiError = (message: string) => Object.assign(new Error(message), { name: "ApiError" });

function deps(confirmResult = true): ActionDeps & { confirm: ReturnType<typeof vi.fn>; toastSuccess: ReturnType<typeof vi.fn>; toastError: ReturnType<typeof vi.fn> } {
  return {
    confirm: vi.fn(async () => confirmResult),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
}

describe("performAction — confirmation gating", () => {
  it("does NOT run the action when confirmation is cancelled", async () => {
    const d = deps(false);
    const run = vi.fn(async () => "ok");
    const ok = await performAction(d, { confirm: { title: "Delete?" }, run });
    expect(d.confirm).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });

  it("runs the action exactly once when confirmed", async () => {
    const d = deps(true);
    const run = vi.fn(async () => "ok");
    const ok = await performAction(d, { confirm: { title: "Delete?" }, run, success: "Deleted" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(d.toastSuccess).toHaveBeenCalledWith("Deleted");
    expect(ok).toBe(true);
  });

  it("runs without confirmation when none is provided", async () => {
    const d = deps();
    const run = vi.fn(async () => 1);
    await performAction(d, { run });
    expect(d.confirm).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("passes the destructive variant to the confirm dialog", async () => {
    const d = deps(true);
    await performAction(d, { confirm: { title: "Delete video?", variant: "danger" }, run: async () => 1 });
    expect(d.confirm).toHaveBeenCalledWith(expect.objectContaining({ variant: "danger" }));
  });
});

describe("performAction — pending + feedback", () => {
  it("toggles pending true then false around the run", async () => {
    const d = deps();
    const order: boolean[] = [];
    await performAction(d, { run: async () => 1, setPending: (p) => order.push(p) });
    expect(order).toEqual([true, false]);
  });

  it("shows a success toast and calls onSuccess with the result", async () => {
    const d = deps();
    const onSuccess = vi.fn();
    await performAction(d, { run: async () => ({ id: "x" }), success: "Saved", onSuccess });
    expect(d.toastSuccess).toHaveBeenCalledWith("Saved");
    expect(onSuccess).toHaveBeenCalledWith({ id: "x" });
  });

  it("shows an error toast on failure and still clears pending", async () => {
    const d = deps();
    const setPending = vi.fn();
    const ok = await performAction(d, {
      run: async () => { throw apiError("Cannot delete"); },
      setPending,
    });
    expect(ok).toBe(false);
    expect(d.toastError).toHaveBeenCalledWith("Cannot delete");
    expect(setPending).toHaveBeenLastCalledWith(false);
  });

  it("uses a custom error message when provided", async () => {
    const d = deps();
    await performAction(d, { run: async () => { throw new Error("boom"); }, error: "Unable to delete video." });
    expect(d.toastError).toHaveBeenCalledWith("Unable to delete video.");
  });
});
