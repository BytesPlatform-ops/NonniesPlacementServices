"use client";

import { useRef } from "react";
import { ShieldCheck, HeartPulse, Users, Star, Stethoscope, ArrowDown, Brain, BadgeDollarSign } from "lucide-react";
import { gsap } from "@/lib/gsap";
import { useGSAP } from "@gsap/react";
import { onReady } from "@/lib/ready";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/animation/MagneticButton";
import { AnimatedCounter } from "@/components/animation/AnimatedCounter";
import { WebGLBackdrop } from "@/components/webgl/WebGLBackdrop";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/data/navigation";

// Editorial headline — one clear statement, a single gold-accented focal word.
const LINES: { word: string; accent?: boolean }[][] = [
  [{ word: "Real" }, { word: "beds," }],
  [{ word: "matched", accent: true }, { word: "to" }, { word: "real" }, { word: "needs." }],
];

const TRUST = [
  { icon: BadgeDollarSign, label: "$0 cost to families" },
  { icon: HeartPulse, label: "RN-reviewed specialty matching" },
  { icon: Brain, label: "Mental & Behavioral Health" },
  { icon: ShieldCheck, label: "Dementia & Alzheimer's" },
  { icon: Users, label: "Families, hospitals & providers" },
];

const STATS = [
  { value: 100, suffix: "%", l: "Referrals RN-reviewed" },
  { value: 12, l: "Facility & care types" },
  { value: 0, prefix: "$", l: "Cost to families" },
  { value: 39, l: "WA counties served" },
];

export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !root.current) return;
      const scope = root.current;
      const words = scope.querySelectorAll<HTMLElement>("[data-word]");
      const fade = scope.querySelectorAll<HTMLElement>("[data-fade]");
      const cards = scope.querySelectorAll<HTMLElement>("[data-card]");

      gsap.set(words, { yPercent: 120, opacity: 0 });
      gsap.set(fade, { y: 24, opacity: 0 });
      gsap.set(cards, { y: 40, opacity: 0, scale: 0.96 });

      const cleanup = onReady(() => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.to(words, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06 })
          .to(fade, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 }, "-=0.55")
          .to(cards, { y: 0, opacity: 1, scale: 1, duration: 0.9, stagger: 0.14 }, "-=0.7");
      });
      return cleanup;
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative flex min-h-[100svh] items-center overflow-hidden bg-midnight text-white">
      <WebGLBackdrop bloom overlay="hero" />

      <Container className="relative z-10 py-28 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Copy */}
          <div>
            <div data-fade className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-mint backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              RN-led placement · Washington State
            </div>

            {/* Inline lineHeight overrides the unlayered `h1{line-height:1.05}` base
                rule (which otherwise beats Tailwind's leading utility). */}
            <h1
              className="mt-6 font-display text-[clamp(2.7rem,6.6vw,5.1rem)] font-medium tracking-tight text-white"
              style={{ lineHeight: 1.12 }}
            >
              {LINES.map((line, li) => (
                <span key={li} className="block">
                  {line.map(({ word, accent }, wi) => (
                    <span key={wi} className="mr-[0.22em] inline-block overflow-hidden align-bottom pt-[0.22em] -mt-[0.22em] pb-[0.15em] -mb-[0.15em]">
                      <span data-word className={"inline-block " + (accent ? "gradient-text-mint italic pr-[0.1em]" : "")}>
                        {word}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </h1>

            <p data-fade className="mt-6 max-w-lg text-lg leading-relaxed text-white/75 text-pretty">
              RN-reviewed placement for families, hospitals, and providers — the right care home,
              found faster and with far less stress.
            </p>

            <div data-fade className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticButton>
                <Button href={PRIMARY_CTA.href} variant="primary" size="lg">{PRIMARY_CTA.label}</Button>
              </MagneticButton>
              <Button href={SECONDARY_CTA.href} variant="outline-light" size="lg">{SECONDARY_CTA.label}</Button>
            </div>

            <ul data-fade className="mt-8 flex flex-col gap-2.5 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-mint" aria-hidden /> {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Media + floating product cards */}
          <div className="relative">
            <div data-card>
              <ParallaxMedia
                kind="video"
                src="/assets/videos/hero-care-loop.mp4"
                poster="/assets/images/hero-family-goldenhour.jpg"
                alt="A caregiver supporting an elderly person at home"
                className="aspect-[4/5] w-full shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] sm:aspect-[5/5]"
                rounded="rounded-[2rem]"
                overlay
                speed={8}
              />
            </div>

            {/* Match card */}
            <div data-card className="absolute -left-4 top-6 w-56 rounded-2xl border border-mint/25 bg-midnight-800/85 p-4 shadow-2xl backdrop-blur-xl sm:-left-8">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-mint">Match found</p>
              <p className="mt-1 font-display text-lg text-white">Cedar Grove AFH</p>
              <p className="text-xs text-white/60">Memory care · Private · 6 mi</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div className="hero-match-fill h-full rounded-full bg-gradient-to-r from-teal to-mint" />
                </div>
                <span className="text-sm font-semibold text-mint">92%</span>
              </div>
            </div>

            {/* Live availability chip */}
            <div data-card className="absolute -right-2 top-14 inline-flex items-center gap-2 rounded-full border border-white/15 bg-midnight-800/85 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl sm:-right-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              1 bed available today
            </div>

            {/* RN review chip */}
            <div data-card className="absolute -right-2 bottom-16 w-52 rounded-2xl border border-mint/25 bg-mint/10 p-3.5 shadow-2xl backdrop-blur-xl sm:-right-6">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-mint" aria-hidden />
                <span className="text-xs font-semibold text-mint">RN review complete</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">&ldquo;Care level &amp; funding confirmed — cleared to connect.&rdquo;</p>
            </div>

            {/* Rating pill */}
            <div data-card className="absolute -bottom-3 left-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-midnight-800/80 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-xl">
              <Star className="h-3.5 w-3.5 fill-coral text-coral" aria-hidden /> Trusted by WA families
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div data-fade className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.l} className="group bg-midnight/30 px-5 py-5 text-center backdrop-blur-sm transition-colors duration-300 hover:bg-mint/5">
              <p className="font-display text-3xl font-semibold text-mint">
                <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-xs text-white/60">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div data-fade className="mt-12 flex justify-center">
          <span className="inline-flex flex-col items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/40">
            <ArrowDown className="hero-scroll-cue h-4 w-4 text-mint" aria-hidden />
            Scroll
          </span>
        </div>
      </Container>
    </section>
  );
}
