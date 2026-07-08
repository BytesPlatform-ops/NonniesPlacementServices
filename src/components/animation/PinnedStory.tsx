"use client";

import { useRef, useState, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { usePinnedEnabled } from "@/hooks/usePinnedEnabled";

export type StoryStep = { eyebrow: string; title: string; description: string };

/**
 * Reusable pinned scrollytelling engine (§ pinned scrollytelling). Left column
 * cross-fades step text; right column renders `visual(active)`. On capable
 * viewports it pins + scrubs; otherwise it renders a safe stacked layout.
 * Uses usePinnedEnabled so the pinned tree never unmounts mid-life (no
 * ScrollTrigger removeChild crash).
 */
export function PinnedStory({
  steps,
  visual,
  tone = "light",
  className,
  railLabel,
}: {
  steps: StoryStep[];
  visual: (active: number) => ReactNode;
  tone?: "light" | "dark";
  className?: string;
  railLabel?: string;
}) {
  const pinRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const usePinned = usePinnedEnabled(1024);
  const dark = tone === "dark";

  useGSAP(
    () => {
      if (!usePinned || !pinRef.current) return;
      const texts = gsap.utils.toArray<HTMLElement>("[data-story-text]");
      const n = steps.length;
      gsap.set(texts, { autoAlpha: 0, y: 28 });
      gsap.set(texts[0], { autoAlpha: 1, y: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: `+=${n * 85}%`,
          scrub: 1,
          pin: true,
          snap: n > 1 ? { snapTo: 1 / (n - 1), duration: 0.3, ease: "power1.inOut" } : undefined,
          onUpdate: (self) => setActive(Math.round(self.progress * (n - 1))),
        },
      });
      for (let i = 1; i < n; i++) {
        tl.to(texts[i - 1], { autoAlpha: 0, y: -28, duration: 0.4 }, i).to(
          texts[i],
          { autoAlpha: 1, y: 0, duration: 0.4 },
          i + 0.05,
        );
      }
      // useGSAP context reverts the pin cleanly on cleanup.
    },
    { scope: pinRef, dependencies: [usePinned, steps.length] },
  );

  if (!usePinned) {
    return (
      <div className={cn("mt-10 flex flex-col gap-8", className)}>
        {steps.map((step, i) => (
          <div key={step.title} className="grid gap-5 sm:grid-cols-2 sm:items-center">
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-mint" : "text-teal")}>
                {step.eyebrow}
              </p>
              <h3 className={cn("mt-2 font-display text-2xl font-medium", dark ? "text-white" : "text-navy")}>
                {step.title}
              </h3>
              <p className={cn("mt-2 text-[0.95rem] leading-relaxed", dark ? "text-white/65" : "text-slate-ink")}>
                {step.description}
              </p>
            </div>
            <div className="aspect-[4/3] w-full">{visual(i)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={pinRef} className={cn("min-h-[100svh]", className)}>
      <div className="mx-auto grid min-h-[100svh] w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:px-12">
        <div className="relative">
          <ol className="mb-8 flex gap-2" aria-label={railLabel}>
            {steps.map((s, i) => (
              <li
                key={s.title}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300",
                  i <= active ? (dark ? "bg-mint" : "bg-teal") : dark ? "bg-white/15" : "bg-navy/10",
                )}
              />
            ))}
          </ol>
          <div className="relative min-h-[15rem]">
            {steps.map((step) => (
              <div key={step.title} data-story-text className="absolute inset-0">
                <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", dark ? "text-mint" : "text-teal")}>
                  {step.eyebrow}
                </p>
                <h3 className={cn("mt-3 font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-medium leading-tight", dark ? "text-white" : "text-navy")}>
                  {step.title}
                </h3>
                <p className={cn("mt-4 max-w-md text-lg leading-relaxed", dark ? "text-white/70" : "text-slate-ink")}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative w-full">{visual(active)}</div>
      </div>
    </div>
  );
}
