"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SplitText } from "gsap/SplitText";
import { onReady } from "@/lib/ready";
import { cn } from "@/lib/utils";

type Trigger = "scroll" | "ready";

/**
 * Word-by-word heading reveal (§ kinetic type — hero only per research, plus
 * key section headings). Uses GSAP SplitText, reverts the split on cleanup so
 * React never conflicts with the wrapped spans. Reduced-motion: plain text.
 */
type HeadingTag = "h1" | "h2" | "h3" | "h4";

export function SplitHeading({
  as = "h2",
  text,
  className,
  trigger = "scroll",
  delay = 0,
  stagger = 0.06,
}: {
  as?: HeadingTag;
  text: string;
  className?: string;
  trigger?: Trigger;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      gsap.registerPlugin(SplitText);
      const split = new SplitText(el, { type: "words", wordsClass: "split-word", aria: "auto" });
      gsap.set(el, { autoAlpha: 1 });
      gsap.set(split.words, { yPercent: 60, opacity: 0 });

      const play = () =>
        gsap.to(split.words, {
          yPercent: 0,
          opacity: 1,
          duration: 0.85,
          delay,
          ease: "power3.out",
          stagger,
        });

      let cleanupReady: (() => void) | undefined;
      if (trigger === "ready") {
        cleanupReady = onReady(play);
      } else {
        gsap.to(split.words, {
          yPercent: 0,
          opacity: 1,
          duration: 0.85,
          ease: "power3.out",
          stagger,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      }

      return () => {
        cleanupReady?.();
        split.revert();
      };
    },
    { scope: ref, dependencies: [text] },
  );

  // Rendered visible for no-JS/reduced-motion; GSAP hides→reveals words when active.
  const Tag = as;
  return (
    <Tag ref={ref} className={cn("[&_.split-word]:inline-block", className)}>
      {text}
    </Tag>
  );
}
