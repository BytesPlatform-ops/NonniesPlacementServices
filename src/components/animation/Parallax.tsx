"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Subtle scroll parallax on `transform` only (§C). Positive `speed` drifts the
 * element up as it passes; disabled for reduced motion.
 */
export function Parallax({
  className,
  children,
  speed = 12,
}: {
  className?: string;
  children: React.ReactNode;
  /** Percent of vertical drift across the scroll range. */
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      gsap.to(el, {
        yPercent: -speed,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    },
    { scope: ref, dependencies: [speed] },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
