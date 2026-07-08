"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

/**
 * Image that wipes into view via clip-path + a gentle scale settle (§3.6).
 * Reduced-motion: renders fully revealed.
 */
export function ClipRevealImage({
  src,
  alt,
  width,
  height,
  className,
  imgClassName,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      gsap.set(el, { clipPath: "inset(0 0 100% 0)", scale: 1.08 });
      return onInView(el, () => {
        gsap.to(el, { clipPath: "inset(0 0 0% 0)", scale: 1, duration: 1.1, ease: "power3.out" });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
