"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Hospital } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, PRIMARY_CTA, SECONDARY_CTA, REFERRAL_CTA } from "@/data/navigation";
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
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Primary"
            className={cn(
              "flex items-center justify-between gap-2 rounded-full transition-all duration-300",
              scrolled
                ? "glass px-5 py-2 shadow-soft"
                : "border border-transparent px-5 py-2",
            )}
          >
            <Logo tone={overDarkHero ? "dark" : "light"} size={scrolled ? 38 : 44} className="shrink-0 transition-all" />

            <ul className="hidden items-center gap-1 xl:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-slate-ink transition-all duration-200 hover:text-navy hover:bg-ice hover:ring-1 hover:ring-coral/25",
                        active && "text-navy bg-ice ring-1 ring-coral/40",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {/* Dedicated professional tab — routes straight to the secure portal. */}
              <li>
                <Link
                  href={REFERRAL_CTA.href}
                  aria-current={pathname === REFERRAL_CTA.href ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold text-teal ring-1 ring-teal/30 transition-all duration-200 hover:bg-teal/10 hover:ring-teal/50",
                    pathname === REFERRAL_CTA.href && "bg-teal/10 ring-teal/60",
                  )}
                >
                  <Hospital className="h-4 w-4" aria-hidden />
                  {REFERRAL_CTA.label}
                </Link>
              </li>
            </ul>

            <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
              <Button href={SECONDARY_CTA.href} variant="ghost" size="sm">
                {SECONDARY_CTA.label}
              </Button>
              <MagneticButton>
                <Button href={PRIMARY_CTA.href} variant="primary" size="sm">
                  {PRIMARY_CTA.label}
                </Button>
              </MagneticButton>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-ice xl:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </nav>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
