"use client";

import { useCallback } from "react";
import { useConfirm } from "@/providers/confirm-provider";
import { useToast } from "@/providers/toast-provider";
import { performAction, type PerformActionOptions } from "@/lib/perform-action";

export type { PerformActionOptions as RunActionOptions } from "@/lib/perform-action";

/**
 * Central confirm → pending → run → toast flow for consequential mutations.
 * Returns a function; `false` means the user cancelled or the action failed.
 * MutationButton guards duplicate clicks; callers using this directly (e.g.
 * `<select>` handlers) should gate re-entry via their own pending state.
 */
export function useAction() {
  const confirm = useConfirm();
  const toast = useToast();

  return useCallback(
    <T,>(opts: PerformActionOptions<T>): Promise<boolean> =>
      performAction<T>({ confirm, toastSuccess: toast.success, toastError: toast.error }, opts),
    [confirm, toast],
  );
}
