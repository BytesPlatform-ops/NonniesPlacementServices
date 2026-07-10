"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Hospital } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, PRIMARY_CTA, SECONDARY_CTA, REFERRAL_CTA } from "@/data/navigation";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/Button";

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock scroll + basic focus handling while open (§21 accessible mobile menu).
  useEffect(() => {
    if (!open) return;
    const lenis = (window as unknown as { lenis?: { stop: () => void; start: () => void } }).lenis;

    // The scroll-lock (body reflow) + Lenis pause are the layout-heavy bits.
    // Running them synchronously as the panel starts moving drops the slide's
    // first frames (the "sudden" jump). Defer them one frame so the transition
    // begins unblocked — the full-screen overlay hides any background scroll in
    // that single frame anyway.
    const raf = requestAnimationFrame(() => {
      document.body.classList.add("no-scroll");
      lenis?.stop();
    });
    // preventScroll: focusing normally scrolls the element into view, forcing a
    // layout mid-slide. We don't need the scroll — the button is already visible.
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("no-scroll");
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] overflow-hidden xl:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          // Plain translucent scrim — NO backdrop-blur. backdrop-filter re-blurs
          // the whole page (WebGL + GSAP layers) every frame and is what made the
          // panel slide lag on mobile. Opacity on a solid layer is GPU-cheap.
          "absolute inset-0 bg-midnight/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={cn(
          // transform-gpu + will-change isolates the panel on its own compositor
          // layer so the scrim's backdrop-filter can't drag it sideways mid-slide.
          "absolute right-0 top-0 flex h-full w-[86%] max-w-sm transform-gpu flex-col bg-white shadow-2xl transition-transform duration-300 ease-out will-change-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-4">
          <Logo size={40} />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy hover:bg-ice"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 py-6">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block rounded-xl px-4 py-3.5 text-lg font-medium text-navy transition-colors hover:bg-ice"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {/* Dedicated professional funnel — highlighted for discharge planners. */}
            <li className="mt-2 border-t border-navy/10 pt-3">
              <Link
                href={REFERRAL_CTA.href}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-xl bg-teal/10 px-4 py-3.5 text-lg font-semibold text-teal ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
              >
                <Hospital className="h-5 w-5 shrink-0" aria-hidden />
                {REFERRAL_CTA.label}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col gap-3 border-t border-navy/10 px-6 py-6">
          <Button href={PRIMARY_CTA.href} variant="primary" size="lg" onClick={onClose}>
            {PRIMARY_CTA.label}
          </Button>
          <Button href={SECONDARY_CTA.href} variant="secondary" size="lg" onClick={onClose}>
            {SECONDARY_CTA.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
