"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  className?: string;
  children: React.ReactNode;
  /** Vertical offset the content rises from. */
  y?: number;
  delay?: number;
  duration?: number;
  /** When set, animates children marked `data-reveal` with this stagger (seconds). */
  stagger?: number;
  /** Accepted for API compatibility; ignored (IntersectionObserver-based). */
  start?: string;
};

/**
 * Scroll-triggered rise + fade using IntersectionObserver.
 *
 * Deliberately NOT GSAP/ScrollTrigger here: ScrollTrigger is synced to Lenis,
 * which doesn't fire on programmatic scroll and can be flaky — leaving content
 * stuck invisible (a large empty gap). IntersectionObserver fires reliably on
 * any scroll, and the hidden state is only ever applied by JS that is about to
 * reveal it, so content can never get stuck blank. Reduced-motion: no-op.
 */
export function Reveal({
  className,
  children,
  y = 28,
  delay = 0,
  duration = 0.8,
  stagger,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets: HTMLElement[] =
      stagger !== undefined
        ? Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"))
        : [el];
    if (!targets.length) return;

    const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
    targets.forEach((t, i) => {
      t.style.willChange = "opacity, transform";
      t.style.opacity = "0";
      t.style.transform = `translateY(${y}px)`;
      const d = delay + i * (stagger ?? 0);
      t.style.transition = `opacity ${duration}s ${ease} ${d}s, transform ${duration}s ${ease} ${d}s`;
    });

    const reveal = () => {
      targets.forEach((t) => {
        t.style.opacity = "1";
        t.style.transform = "none";
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);

    // Safety: if the observer never fires (edge cases), reveal after a beat so
    // nothing can stay hidden.
    const failsafe = window.setTimeout(reveal, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [y, delay, duration, stagger]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
