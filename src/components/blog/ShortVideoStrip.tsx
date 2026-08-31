"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, X } from "lucide-react";
import type { ShortVideoItem } from "@/lib/platform/content";
import { AUTOSCROLL_INTERVAL_MS, manualPauseUntil, shouldAutoplayInline, shouldAutoscroll } from "./carousel";

/** Best-effort access to the site's Lenis instance without redeclaring its global type. */
function getLenis(): { stop?: () => void; start?: () => void } | undefined {
  return (window as unknown as { lenis?: { stop?: () => void; start?: () => void } }).lenis;
}

/**
 * Immersive, full-bleed short-video wall. Large portrait panels autoplay MUTED +
 * looped inline (poster first, video started only as a card enters the horizontal
 * viewport via IntersectionObserver), the rail auto-advances every ~2.5s, and the
 * user can drag/swipe/scroll. Auto-progression pauses on hover, drag, an open
 * lightbox, a hidden tab, or `prefers-reduced-motion`. Clicking a card opens the
 * controlled lightbox where audio is allowed.
 */
export function ShortVideoStrip({ videos }: { videos: ShortVideoItem[] }) {
  const [active, setActive] = useState<ShortVideoItem | null>(null);
  const [reduced, setReduced] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pausedUntilRef = useRef(0);
  const drag = useRef({ down: false, startX: 0, scroll: 0, moved: false });

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mql.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const inlineEnabled = shouldAutoplayInline({ reducedMotion: reduced, lightboxOpen: active !== null, tabHidden });

  // Duplicate the list so forward auto-advance can wrap seamlessly (identical pixels).
  const loop = videos.length > 1 ? [...videos, ...videos] : videos;

  const stepPx = (): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const cards = el.querySelectorAll<HTMLElement>("[data-card]");
    if (cards.length < 2) return cards[0]?.offsetWidth ?? 0;
    return cards[1]!.offsetLeft - cards[0]!.offsetLeft;
  };

  const advance = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const step = stepPx();
    const half = el.scrollWidth / 2;
    const target = el.scrollLeft + step;
    if (videos.length > 1 && target >= half) {
      // Wrap: reposition to the identical spot in the first set (invisible), then continue.
      el.scrollTo({ left: target - half, behavior: "auto" });
    } else {
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [videos.length]);

  // Auto-advance loop.
  useEffect(() => {
    const enabled = shouldAutoscroll({
      reducedMotion: reduced,
      hovering,
      dragging: draggingRef.current,
      lightboxOpen: active !== null,
      tabHidden,
      itemCount: videos.length,
      now: 0,
      pausedUntil: 0,
    });
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (draggingRef.current) return;
      if (Date.now() < pausedUntilRef.current) return;
      advance();
    }, AUTOSCROLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduced, hovering, active, tabHidden, videos.length, advance]);

  // Manual-scroll wrap (forward): keep the loop seamless when the user scrolls past the midpoint.
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || videos.length < 2) return;
    const half = el.scrollWidth / 2;
    if (el.scrollLeft >= half) el.scrollLeft -= half;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    draggingRef.current = true;
    drag.current = { down: true, startX: e.clientX, scroll: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scroll - dx;
  };
  const endDrag = () => {
    drag.current.down = false;
    draggingRef.current = false;
    pausedUntilRef.current = manualPauseUntil(Date.now()); // resume auto after a delay
  };

  const open = useCallback((v: ShortVideoItem) => {
    if (drag.current.moved) return; // ignore a click that was really a drag
    setActive(v);
  }, []);

  if (videos.length === 0) return null;

  return (
    <>
      <div
        ref={trackRef}
        onScroll={onScroll}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false); pausedUntilRef.current = manualPauseUntil(Date.now()); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={() => { pausedUntilRef.current = manualPauseUntil(Date.now()); }}
        className="flex cursor-grab snap-x snap-mandatory gap-2 overflow-x-auto pb-3 active:cursor-grabbing sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Short videos"
      >
        {loop.map((v, i) => (
          <VideoCard key={`${v.id}-${i}`} video={v} inlineEnabled={inlineEnabled} rootRef={trackRef} onOpen={() => open(v)} />
        ))}
      </div>

      {active ? <VideoLightbox video={active} onClose={() => setActive(null)} /> : null}
    </>
  );
}

function VideoCard({
  video,
  inlineEnabled,
  rootRef,
  onOpen,
}: {
  video: ShortVideoItem;
  inlineEnabled: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
}) {
  const vRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  // Only play videos that are within / approaching the horizontal viewport.
  useEffect(() => {
    const el = vRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setNear(entries[0]?.isIntersecting ?? false),
      { root: rootRef.current, threshold: 0.2, rootMargin: "0px 300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  useEffect(() => {
    const el = vRef.current;
    if (!el) return;
    if (near && inlineEnabled) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [near, inlineEnabled]);

  return (
    <button
      type="button"
      role="listitem"
      data-card
      onClick={onOpen}
      className="group relative aspect-[9/16] max-h-[82vh] w-[86vw] min-w-[240px] max-w-[420px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-midnight text-left outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-mint sm:w-[46vw] md:w-[30vw] lg:w-[24vw] xl:w-[22vw]"
      aria-label={`Watch video: ${video.title}`}
    >
      <video
        ref={vRef}
        src={video.videoUrl}
        poster={video.posterImageUrl ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/10 to-transparent" aria-hidden />

      {/* Subtle "open" affordance — revealed on hover/focus since the preview is already live. */}
      <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Expand className="h-4 w-4" aria-hidden />
      </span>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
        {video.sourceLabel ? (
          <span className="mb-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
            {video.sourceLabel}
          </span>
        ) : null}
        <p className="font-display text-base font-medium leading-snug text-white sm:text-lg">{video.title}</p>
        {video.caption ? <p className="mt-1 line-clamp-2 text-xs text-white/75">{video.caption}</p> : null}
      </div>
    </button>
  );
}

function VideoLightbox({ video, onClose }: { video: ShortVideoItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getLenis()?.stop?.();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      getLenis()?.start?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white outline-none hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {/* key forces a fresh element per video so switching never keeps old audio playing */}
        <video
          key={video.id}
          src={video.videoUrl}
          poster={video.posterImageUrl ?? undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full rounded-[24px] border border-white/10 bg-black object-contain shadow-card"
        />
        <p className="mt-3 text-center font-display text-lg font-medium text-white">{video.title}</p>
        {video.caption ? <p className="mt-1 text-center text-sm text-white/70">{video.caption}</p> : null}
      </div>
    </div>
  );
}
