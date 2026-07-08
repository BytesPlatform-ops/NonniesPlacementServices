"use client";

import { useEffect, useState } from "react";

/**
 * Decides whether ScrollTrigger pinning should be used for a scrollytelling
 * section. Returns `false` on the server and first client paint, then upgrades
 * to `true` exactly once when the client confirms a wide, non-reduced viewport.
 *
 * Crucially it never flips back to `false`. ScrollTrigger's `pin` re-parents the
 * pinned node into a pin-spacer wrapper; if React later deleted that node
 * because a breakpoint/reduced-motion change flipped this value, it would throw
 * "removeChild: node is not a child". Starting false (safe stacked layout) and
 * only ever upgrading avoids that entirely — including for reduced-motion users.
 */
export function usePinnedEnabled(minWidth = 1024): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const capable =
      window.matchMedia(`(min-width: ${minWidth}px)`).matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Upgrade once; never downgrade (see doc comment).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability upgrade, guarded
    if (capable) setEnabled(true);
  }, [minWidth]);

  return enabled;
}
