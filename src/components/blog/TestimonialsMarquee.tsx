"use client";

import type { TestimonialItem } from "@/lib/platform/content";

/**
 * A premium, flowing testimonials marquee: elegant quote typography, generous
 * whitespace, continuous horizontal motion that pauses on hover. Respects
 * prefers-reduced-motion — motion is disabled and the row becomes a normal
 * horizontal scroll area so every testimonial stays readable. Understated,
 * Nonni's-branded interpretation (no cloned styling).
 */
export function TestimonialsMarquee({ testimonials }: { testimonials: TestimonialItem[] }) {
  if (testimonials.length === 0) return null;

  // Duplicate the sequence once for a seamless loop; the copy is hidden from AT.
  const loop = [
    ...testimonials.map((t) => ({ t, dup: false })),
    ...testimonials.map((t) => ({ t, dup: true })),
  ];

  return (
    <div className="group relative">
      <style>{`
        @keyframes nonnis-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .nonnis-marquee-track { animation: nonnis-marquee 60s linear infinite; }
        .group:hover .nonnis-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .nonnis-marquee-track { animation: none; transform: none; }
          .nonnis-marquee-viewport { overflow-x: auto; }
        }
      `}</style>

      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ivory to-transparent sm:w-24" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ivory to-transparent sm:w-24" aria-hidden />

      <div className="nonnis-marquee-viewport overflow-hidden">
        <ul className="nonnis-marquee-track flex w-max gap-5 sm:gap-6">
          {loop.map(({ t, dup }, i) => (
            <li
              key={`${t.id}-${dup ? "b" : "a"}-${i}`}
              className="w-[min(86vw,440px)] shrink-0"
              aria-hidden={dup || undefined}
            >
              <figure className="flex h-full flex-col rounded-[26px] border border-navy/10 bg-white p-7 shadow-soft sm:p-8">
                <span className="font-display text-5xl leading-none text-coral/40" aria-hidden>&ldquo;</span>
                <blockquote className="mt-2 flex-1 font-display text-xl font-medium leading-snug text-navy sm:text-2xl">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-5 border-t border-navy/10 pt-4 text-sm">
                  {t.clientName ? <span className="font-semibold text-navy">{t.clientName}</span> : <span className="font-semibold text-navy">Nonni&rsquo;s client</span>}
                  <span className="mt-0.5 block text-slate-ink/70">
                    {[t.clientTitle, t.organization, t.location].filter(Boolean).join(" · ")}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
