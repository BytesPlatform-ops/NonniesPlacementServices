"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { LogoMark } from "./LogoMark";
import { signalReady } from "@/lib/ready";

const SESSION_KEY = "nonnis-preloaded";

/**
 * Branded reveal that morphs into the hero (§3.8-A): navy panel → logo stroke-
 * draw → real 0–100 progress → curtain wipe up.
 *
 * IMPORTANT: this component never unmounts. When finished it hides itself via
 * GSAP (display:none) rather than returning null. That keeps React from ever
 * removing DOM nodes that GSAP has mutated — the source of the classic
 * "removeChild: node is not a child" crash. Shows once per session; skipped for
 * reduced motion.
 */
export function Preloader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const seen = sessionStorage.getItem(SESSION_KEY) === "1";
      const forced = new URLSearchParams(window.location.search).get("loader") === "1";

      // Skip: hide instantly (before paint via useGSAP's layout effect) and signal.
      if (!forced && (reduced || seen)) {
        gsap.set(root, { display: "none" });
        signalReady();
        return;
      }

      gsap.registerPlugin(DrawSVGPlugin);

      const STATUS = [
        "Reviewing care needs",
        "Checking provider availability",
        "Preparing RN-reviewed matches",
        "Building placement path",
      ];
      const progress = { value: 0 };
      let lastStatus = -1;
      const render = () => {
        const v = Math.round(progress.value);
        if (counterRef.current) counterRef.current.textContent = String(v);
        if (barRef.current) barRef.current.style.transform = `scaleX(${progress.value / 100})`;
        const idx = Math.min(STATUS.length - 1, Math.floor((progress.value / 100) * STATUS.length));
        if (idx !== lastStatus && statusRef.current) {
          lastStatus = idx;
          statusRef.current.textContent = STATUS[idx];
        }
      };

      const paths = root.querySelectorAll(".logo-mark path");
      gsap.set(paths, { drawSVG: "0%" });
      render();

      const draw = gsap.to(paths, {
        drawSVG: "100%",
        duration: 1.1,
        stagger: 0.12,
        ease: "power2.inOut",
        delay: 0.1,
      });
      const creep = gsap.to(progress, { value: 90, duration: 1.5, ease: "power1.out", onUpdate: render });

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        gsap.to(progress, {
          value: 100,
          duration: 0.4,
          ease: "power2.out",
          overwrite: true,
          onUpdate: render,
          onComplete: () => {
            gsap.to(root, {
              yPercent: -100,
              duration: 0.9,
              ease: "power4.inOut",
              onComplete: () => {
                sessionStorage.setItem(SESSION_KEY, "1");
                // Hide (do NOT unmount) so GSAP-touched DOM is never removed by React.
                gsap.set(root, { display: "none" });
                signalReady();
              },
            });
          },
        });
      };

      const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
      const loadReady = new Promise<void>((r) => {
        if (document.readyState === "complete") r();
        else window.addEventListener("load", () => r(), { once: true });
      });
      // Minimum on-screen time so the branded loader is always seen (assets can
      // resolve in ~0ms locally, which otherwise makes it flash by).
      const minTime = new Promise<void>((r) => window.setTimeout(r, 2000));
      Promise.all([fontsReady, loadReady, minTime]).then(finish);
      const failsafe = window.setTimeout(finish, 4200);

      return () => {
        window.clearTimeout(failsafe);
        draw.kill();
        creep.kill();
      };
    },
    { scope: rootRef },
  );

  return (
    <div
      id="nonnis-preloader"
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-midnight"
      role="status"
      aria-live="polite"
      aria-label="Loading Nonni's Placement Services"
    >
      {/* Soft animated network glow behind the mark */}
      <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/10 blur-3xl" />

      <div className="relative flex flex-col items-center">
        <LogoMark className="h-24 w-24" />
        <div className="mt-10 h-px w-56 overflow-hidden bg-white/15">
          <div ref={barRef} className="h-full origin-left scale-x-0 bg-gradient-to-r from-teal to-mint" />
        </div>
        <div className="mt-4 font-display text-sm tracking-[0.3em] text-white/70">
          {/* Empty on purpose — GSAP drives textContent; no React child to reconcile. */}
          <span ref={counterRef} />
          <span className="text-mint">%</span>
        </div>
        <p ref={statusRef} className="mt-3 h-4 text-xs font-medium tracking-wide text-mint/80" />
      </div>
    </div>
  );
}
