"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

export type Slide =
  | { type: "image"; src: string; caption: string; sub?: string; eyebrow?: string; alt?: string }
  | { type: "video"; src: string; poster?: string; caption: string; sub?: string; eyebrow?: string; alt?: string };

/**
 * Premium 4-up media carousel (Embla + Autoplay).
 * Desktop shows 4 cinematic cards, laptop 3, tablet 2, mobile ~1.15 — all inside
 * the page container (never bleeds to the corners). Auto-advances one card at a
 * time, loops, pauses on hover, arrows + progress + count, drag/swipe. Videos in
 * view play (muted, looped, inline); the rest pause. Reduced-motion: no autoplay.
 */
export function VIPVideoCarousel({ slides, className }: { slides: Slide[]; className?: string }) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const plugins = useMemo(
    () => (reduced ? [] : [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]),
    [reduced],
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", slidesToScroll: 1, containScroll: false, dragFree: false },
    plugins,
  );

  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(slides.length);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const goTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from Embla
    setSnapCount(emblaApi.scrollSnapList().length);
    const syncVideos = () => {
      const inView = new Set(emblaApi.slidesInView());
      videoRefs.current.forEach((v, i) => {
        if (!v) return;
        if (inView.has(i)) v.play().catch(() => {});
        else v.pause();
      });
    };
    const onSelect = () => {
      setSelected(emblaApi.selectedScrollSnap());
      syncVideos();
    };
    emblaApi.on("select", onSelect).on("slidesInView", syncVideos).on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect).off("slidesInView", syncVideos).off("reInit", onSelect);
    };
  }, [emblaApi]);

  // Clip-path reveal on first entrance (reliable IntersectionObserver).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;
    el.style.clipPath = "inset(4% round 1.75rem)";
    el.style.opacity = "0.5";
    el.style.transition = "clip-path 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease";
    return onInView(el, () => {
      el.style.clipPath = "inset(0% round 1.75rem)";
      el.style.opacity = "1";
    });
  }, [reduced]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-5">
          {slides.map((s, i) => (
            <article
              key={i}
              className={cn(
                "group relative min-w-0 shrink-0 overflow-hidden rounded-[1.75rem] border border-white/10 shadow-card transition-[transform,opacity] duration-500",
                "h-[360px] lg:h-[420px]",
                "basis-[86%] sm:basis-[calc((100%-20px)/2)] lg:basis-[calc((100%-40px)/3)] xl:basis-[calc((100%-60px)/4)]",
                i === selected ? "opacity-100" : "opacity-95",
                "hover:-translate-y-1.5",
              )}
            >
              {s.type === "video" ? (
                <video
                  ref={(el) => { videoRefs.current[i] = el; }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={s.poster}
                  aria-label={s.caption}
                >
                  <source src={s.src} type="video/mp4" />
                </video>
              ) : (
                <Image
                  src={s.src}
                  alt={s.caption}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width:640px) 86vw, (max-width:1280px) 33vw, 24vw"
                />
              )}

              {/* Deep brand overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/25 to-transparent" />
              {s.type === "video" && (
                <span className="absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-white/15 px-2 text-[0.6rem] font-bold uppercase tracking-wide text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Live
                </span>
              )}

              {/* Glass caption */}
              <div className="absolute inset-x-3 bottom-3">
                <div className="rounded-2xl border border-white/15 bg-midnight/45 p-3.5 backdrop-blur-xl">
                  {s.eyebrow && (
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-mint">{s.eyebrow}</span>
                  )}
                  <p className="mt-0.5 font-display text-[0.98rem] font-medium leading-snug text-white">{s.caption}</p>
                  {s.sub && <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-white/65">{s.sub}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} aria-label="Previous" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition hover:border-teal/50 hover:bg-white">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={next} aria-label="Next" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition hover:border-teal/50 hover:bg-white">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative mx-2 h-1 flex-1 overflow-hidden rounded-full bg-navy/12">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal to-mint transition-[width] duration-500"
            style={{ width: `${snapCount > 1 ? ((selected + 1) / snapCount) * 100 : 100}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-navy">
            {String(selected + 1).padStart(2, "0")} <span className="text-slate-ink/50">/ {String(snapCount).padStart(2, "0")}</span>
          </span>
          <div className="hidden items-center gap-1.5 sm:flex">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`} className={cn("h-2 rounded-full transition-all", i === selected ? "w-6 bg-teal" : "w-2 bg-navy/20 hover:bg-navy/40")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
