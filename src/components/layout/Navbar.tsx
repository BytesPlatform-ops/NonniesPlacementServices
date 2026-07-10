"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, PRIMARY_CTA, SECONDARY_CTA, RN_PHONE } from "@/data/navigation";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/animation/MagneticButton";
import { MobileMenu } from "./MobileMenu";

// Routes whose hero is deep umber — the transparent (unscrolled) navbar sits on
// dark there, so the logo switches to its reversed (white) lockup for contrast.
const DARK_HERO_ROUTES = new Set(["/", "/providers", "/pricing"]);

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const overDarkHero = !scrolled && DARK_HERO_ROUTES.has(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[padding] duration-300",
          scrolled ? "py-2" : "py-4",
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Primary"
            className={cn(
              "flex items-center justify-between rounded-full transition-all duration-300",
              scrolled
                ? "glass px-4 py-2 shadow-soft"
                : "border border-transparent px-4 py-2",
            )}
          >
            <Logo tone={overDarkHero ? "dark" : "light"} size={scrolled ? 38 : 44} className="shrink-0 transition-all" />

            <ul className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-sm font-medium text-slate-ink transition-all duration-200 hover:text-navy hover:bg-ice hover:ring-1 hover:ring-coral/25",
                        active && "text-navy bg-ice ring-1 ring-coral/40",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="hidden items-center gap-2 lg:flex">
              <Button href={SECONDARY_CTA.href} variant="ghost" size="sm" className="hidden xl:inline-flex">
                {SECONDARY_CTA.label}
              </Button>
              <Button href={PRIMARY_CTA.href} variant="primary" size="sm">
                {PRIMARY_CTA.label}
              </Button>
              {/* High-visibility click-to-call RN CTA — native dialer on mobile/tablet. */}
              <MagneticButton>
                <a
                  href={RN_PHONE.href}
                  className="group inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-soft transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-navy-700 hover:shadow-card active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  <span className="relative flex h-2.5 w-2.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
                  </span>
                  <Phone className="h-4 w-4" aria-hidden />
                  {RN_PHONE.label}
                </a>
              </MagneticButton>
            </div>

            {/* Mobile: compact click-to-call in the fixed header (sticks to top) + menu. */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <a
                href={RN_PHONE.href}
                aria-label={RN_PHONE.label}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-navy px-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-700 active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" aria-hidden />
                RN
              </a>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-ice"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
