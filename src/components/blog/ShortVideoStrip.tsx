"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, X } from "lucide-react";
import type { ShortVideoItem } from "@/lib/platform/content";

/** Best-effort access to the site's Lenis instance without redeclaring its global type. */
function getLenis(): { stop?: () => void; start?: () => void } | undefined {
  return (window as unknown as { lenis?: { stop?: () => void; start?: () => void } }).lenis;
}

/**
 * Premium short-video browsing: large vertical poster cards, horizontal
 * drag/swipe/scroll, a clear centered play affordance, and a controlled
 * lightbox that plays exactly ONE video at a time (audio only after an explicit
 * click). Keyboard accessible; respects the site's motion language.
 */
export function ShortVideoStrip({ videos }: { videos: ShortVideoItem[] }) {
  const [active, setActive] = useState<ShortVideoItem | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ down: boolean; startX: number; scroll: number; moved: boolean }>({ down: false, startX: 0, scroll: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
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
  };

  const open = useCallback((v: ShortVideoItem) => {
    if (drag.current.moved) return; // ignore click that was really a drag
    setActive(v);
  }, []);

  if (videos.length === 0) return null;

  return (
    <>
      <div
        ref={trackRef}
        className="flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto pb-4 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="list"
        aria-label="Short videos"
      >
        {videos.map((v) => (
          <button
            key={v.id}
            type="button"
            role="listitem"
            onClick={() => open(v)}
            className="group relative aspect-[9/16] w-[220px] shrink-0 snap-start overflow-hidden rounded-[26px] border border-navy/10 bg-midnight text-left shadow-card outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral sm:w-[248px]"
            aria-label={`Play video: ${v.title}`}
          >
            {v.posterImageUrl ? (
              <Image src={v.posterImageUrl} alt="" fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="248px" draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-midnight-700 to-midnight" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-midnight/85 via-midnight/10 to-transparent" aria-hidden />

            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow-glow transition-transform duration-300 group-hover:scale-110">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden />
            </span>

            <div className="absolute inset-x-0 bottom-0 p-4">
              {v.sourceLabel ? <span className="mb-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">{v.sourceLabel}</span> : null}
              <p className="font-display text-base font-medium leading-snug text-white">{v.title}</p>
              {v.caption ? <p className="mt-0.5 line-clamp-2 text-xs text-white/70">{v.caption}</p> : null}
            </div>
          </button>
        ))}
      </div>

      {active ? <VideoLightbox video={active} onClose={() => setActive(null)} /> : null}
    </>
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
