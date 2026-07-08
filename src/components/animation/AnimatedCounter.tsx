"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

/** Count-up on scroll-into-view (§3.7). Falls back to the final value instantly. */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1.8,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const format = (n: number) => `${prefix}${Math.round(n).toLocaleString("en-US")}${suffix}`;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      el.textContent = format(0); // seed via ref; the span has no React child
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        el.textContent = format(value);
        return;
      }
      const obj = { n: 0 };
      return onInView(el, () => {
        gsap.to(obj, {
          n: value,
          duration,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = format(obj.n);
          },
        });
      });
    },
    { scope: ref, dependencies: [value] },
  );

  // Empty initial content — value is written via ref to avoid React/GSAP
  // reconciliation conflicts (removeChild on unmount).
  return <span ref={ref} className={cn(className)} />;
}
