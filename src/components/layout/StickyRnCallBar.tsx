import { Phone } from "lucide-react";
import { RN_PHONE } from "@/data/navigation";

/**
 * Mobile-only sticky click-to-call dock. Fixed to the bottom of the viewport so
 * the "Talk to an RN Now" CTA stays within thumb reach while the page scrolls.
 * Hidden from lg+ where the header already surfaces the same CTA. The `tel:`
 * href launches the native dialer on phones.
 */
export function StickyRnCallBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)] pt-2 lg:hidden"
      style={{ pointerEvents: "none" }}
    >
      <a
        href={RN_PHONE.href}
        aria-label={RN_PHONE.label}
        className="group flex items-center justify-center gap-2.5 rounded-full bg-coral px-6 py-4 text-base font-semibold tracking-tight text-white shadow-card transition-[transform,background-color] duration-200 ease-out hover:bg-coral-600 active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
        style={{ pointerEvents: "auto" }}
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <Phone className="h-5 w-5" aria-hidden />
        {RN_PHONE.label}
      </a>
    </div>
  );
}
