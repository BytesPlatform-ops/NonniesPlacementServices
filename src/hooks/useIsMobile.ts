"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * True when the viewport is at/below `breakpoint` (default 768px). Used to skip
 * WebGL on small screens (§9). `false` during SSR/first paint.
 */
export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}
