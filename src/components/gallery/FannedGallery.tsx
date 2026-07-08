"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Slide } from "@/components/media/VIPVideoCarousel";

/**
 * Fanned media deck (Lando / Angels VIP carousel, in Nonni's warm brand).
 * Active card centered, straight, gold-bordered; neighbours peek rotated ±6°,
 * far cards ±10° and faded. Autoplays (~4s), pauses on hover, supports arrows,
 * dots, swipe, and clicking a side card to bring it forward. The active video
 * plays; the rest pause. Reduced motion: no autoplay, no rotation.
 */
export function FannedGallery({ slides, className }: { slides: Slide[]; className?: string }) {
  const n = slides.length;
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const go = useCallback((i: number) => setSelected(((i % n) + n) % n), [n]);
  const next = useCallback(() => setSelected((s) => (s + 1) % n), [n]);
  const prev = useCallback(() => setSelected((s) => (s - 1 + n) % n), [n]);

  // Autoplay — advance every ~3s unless paused / reduced motion.
  useEffect(() => {
    if (paused || reduced || n <= 1) return;
    const id = window.setInterval(() => setSelected((s) => (s + 1) % n), 3200);
    return () => window.clearInterval(id);
  }, [paused, reduced, n]);

  // Only the active card's video plays.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === selected) v.play().catch(() => {});
      else v.pause();
    });
  }, [selected]);

  // Swipe / drag.
  const startX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 45) (dx < 0 ? next : prev)();
    startX.current = null;
  };

  return (
    <div
      className={cn("relative select-none", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Care moments gallery"
    >
      <div
        className="relative h-[420px] w-full overflow-x-clip lg:h-[500px]"
        style={{ perspective: "1600px" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {slides.map((s, i) => {
          // Signed shortest distance for a looping deck.
          let d = i - selected;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const abs = Math.abs(d);
          const sign = Math.sign(d);
          const visible = abs <= 2;

          let tx = 0, rot = 0, scale = 1, opacity = 1, z = 30;
          if (abs === 1) { tx = sign * 60; rot = sign * 6; scale = 0.9; opacity = 0.75; z = 20; }
          else if (abs === 2) { tx = sign * 100; rot = sign * 10; scale = 0.8; opacity = 0.4; z = 10; }
          else if (abs > 2) { tx = sign * 120; opacity = 0; z = 0; }
          if (reduced) rot = 0;

          const isActive = d === 0;
          return (
            <article
              key={i}
              aria-hidden={!isActive}
              onClick={() => !isActive && visible && go(i)}
              className={cn(
                "group absolute left-1/2 top-1/2 h-full w-[80vw] max-w-[420px] overflow-hidden rounded-[1.75rem] border shadow-card transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive ? "cursor-default border-mint/60 ring-2 ring-mint/40 shadow-glow" : "cursor-pointer border-white/10 hover:opacity-90",
              )}
              style={{
                transform: `translate(-50%, -50%) translateX(${tx}%) rotate(${rot}deg) scale(${scale})`,
                opacity,
                zIndex: z,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              {s.type === "video" ? (
                <video
                  ref={(el) => { videoRefs.current[i] = el; }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  muted loop playsInline preload="metadata" poster={s.poster} aria-label={s.caption}
                >
                  <source src={s.src} type="video/mp4" />
                </video>
              ) : (
                <Image src={s.src} alt={s.caption} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width:640px) 80vw, 420px" />
              )}

              {/* Warm umber overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2b1b0e]/92 via-[#2b1b0e]/25 to-transparent" />

              {isActive && s.type === "video" && (
                <span className="absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-white/15 px-2 text-[0.6rem] font-bold uppercase tracking-wide text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Live
                </span>
              )}

              {/* Glass caption — only on the active card for focus */}
              <div className={cn("absolute inset-x-3 bottom-3 transition-opacity duration-500", isActive ? "opacity-100" : "opacity-0")}>
                <div className="rounded-2xl border border-white/15 bg-[#2b1b0e]/50 p-3.5 backdrop-blur-xl">
                  {s.eyebrow && <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-mint">{s.eyebrow}</span>}
                  <p className="mt-0.5 font-display text-base font-medium leading-snug text-white">{s.caption}</p>
                  {s.sub && <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-white/65">{s.sub}</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} aria-label="Previous" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition-all hover:-translate-x-0.5 hover:border-coral/50 hover:bg-white">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={next} aria-label="Next" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition-all hover:translate-x-0.5 hover:border-coral/50 hover:bg-white">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative mx-2 h-1 flex-1 overflow-hidden rounded-full bg-navy/12">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-coral to-mint transition-[width] duration-500" style={{ width: `${((selected + 1) / n) * 100}%` }} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-navy">
            {String(selected + 1).padStart(2, "0")} <span className="text-slate-ink/50">/ {String(n).padStart(2, "0")}</span>
          </span>
          <div className="hidden items-center gap-1.5 sm:flex">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} className={cn("h-2 rounded-full transition-all", i === selected ? "w-6 bg-coral" : "w-2 bg-navy/20 hover:bg-navy/40")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
