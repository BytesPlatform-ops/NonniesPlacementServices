"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

type Base = {
  className?: string;
  rounded?: string;
  /** Parallax drift in % of the inner media across the scroll range. */
  speed?: number;
  /** Clip-path wipe on entry. */
  clip?: boolean;
  overlay?: boolean;
  children?: React.ReactNode;
  priority?: boolean;
};

type ImageMedia = Base & { src: string; alt: string; kind?: "image" };
type VideoMedia = Base & { src: string; alt?: string; kind: "video"; poster?: string };

/**
 * Premium media tile: an over-scaled image/video that drifts on scroll
 * (parallax) with an optional clip-path reveal. Transform/clip only → 60fps.
 * Reduced-motion: static, fully revealed.
 */
export function ParallaxMedia(props: ImageMedia | VideoMedia) {
  const { className, rounded = "rounded-3xl", speed = 12, clip = true, overlay, children, priority } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      if (clip) {
        gsap.set(wrap, { clipPath: "inset(0 0 100% 0)" });
        onInView(wrap, () => {
          gsap.to(wrap, { clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: "power3.out" });
        });
      }
      gsap.fromTo(
        inner,
        { yPercent: -speed },
        {
          yPercent: speed,
          ease: "none",
          scrollTrigger: { trigger: wrap, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    },
    { scope: wrapRef, dependencies: [speed, clip] },
  );

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", rounded, className)}>
      {/* Inner is over-tall so parallax never exposes edges. */}
      <div ref={innerRef} className="absolute inset-0 -top-[12%] h-[124%] w-full">
        {props.kind === "video" ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={props.poster}
            aria-label={props.alt}
          >
            <source src={props.src} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={props.src}
            alt={props.alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={priority}
            className="object-cover"
          />
        )}
      </div>
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-midnight/70 via-midnight/10 to-transparent" />
      )}
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}
