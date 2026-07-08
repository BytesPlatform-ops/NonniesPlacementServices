"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Reactive reduced-motion preference. `false` during SSR/first paint, then
 * synced to the real preference on the client. (§21)
 */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
