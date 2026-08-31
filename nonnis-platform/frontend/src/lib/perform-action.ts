import type { ConfirmOptions } from "@/providers/confirm-provider";

/** Duck-typed ApiError check (avoids a runtime import of the browser api-client). */
function apiErrorMessage(e: unknown): string | null {
  if (e && typeof e === "object" && (e as { name?: string }).name === "ApiError") {
    return String((e as { message?: string }).message ?? "");
  }
  return null;
}

/**
 * Pure orchestration for a consequential mutation: confirm → pending → run →
 * toast. Extracted from the `useAction` hook so the flow is unit-testable without
 * a DOM. Returns true when the action ran successfully, false when cancelled or
 * failed.
 */

export interface ActionDeps {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
}

export interface PerformActionOptions<T> {
  confirm?: ConfirmOptions;
  run: () => Promise<T>;
  success?: string;
  error?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  setPending?: (pending: boolean) => void;
}

export async function performAction<T>(deps: ActionDeps, opts: PerformActionOptions<T>): Promise<boolean> {
  if (opts.confirm) {
    const ok = await deps.confirm(opts.confirm);
    if (!ok) return false; // cancelled — nothing runs
  }
  opts.setPending?.(true);
  try {
    const result = await opts.run();
    if (opts.success) deps.toastSuccess(opts.success);
    await opts.onSuccess?.(result);
    return true;
  } catch (e) {
    deps.toastError(opts.error ?? apiErrorMessage(e) ?? "Something went wrong. Please try again.");
    return false;
  } finally {
    opts.setPending?.(false);
  }
}
