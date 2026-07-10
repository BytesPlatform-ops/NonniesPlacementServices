import Link from "next/link";
import { Phone, Mail, MapPin, Clock, Heart, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Logo } from "./Logo";
import { FOOTER_SECTIONS } from "@/data/navigation";
import { CONTACT } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-midnight text-white/80">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-teal/20 blur-3xl" />
      <Container className="relative pt-16 pb-8 lg:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo tone="dark" size={48} />
            <p className="mt-5 text-sm leading-relaxed text-white/60">
              RN-led care placement across Washington State — connecting families, hospitals,
              and providers through human-reviewed, intelligent matching.
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-mint" aria-hidden />
                <dd>
                  <a href={`tel:${CONTACT.phonePrimaryHref}`} className="hover:text-white">
                    {CONTACT.phonePrimary}
                  </a>{" "}
                  ·{" "}
                  <a href={`tel:${CONTACT.phoneSecondaryHref}`} className="hover:text-white">
                    {CONTACT.phoneSecondary}
                  </a>
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-mint" aria-hidden />
                <dd>
                  <a href={`mailto:${CONTACT.email}`} className="hover:text-white">
                    {CONTACT.email}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-mint" aria-hidden />
                <dd>
                  {CONTACT.address}
                  <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mint">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Licensed, Bonded, and Insured
                  </span>
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-mint" aria-hidden />
                <dd>{CONTACT.hours}</dd>
              </div>
            </dl>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="relative inline-block text-white/70 transition-colors duration-200 hover:text-white after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-mint after:transition-all after:duration-300 hover:after:w-full"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-3 border-t border-white/10 pt-8 text-center text-xs leading-relaxed text-white/45">
          <p>© {new Date().getFullYear()} Nonni&apos;s Placement Services. All rights reserved.</p>
          <p className="max-w-none text-white/40 lg:whitespace-nowrap">
            Nonni&apos;s provides RN-led placement guidance and intelligent
            matching support — not medical diagnosis, treatment, or guaranteed outcomes.
          </p>
          {/* Washington State elder & vulnerable adult referral compliance disclosure */}
          <p className="max-w-none text-white/40 lg:whitespace-nowrap">
            Nonni&apos;s Placement Services operates in compliance with Chapter 18.330 RCW
            regarding elder and vulnerable adult referral services.
          </p>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs text-white/50">
            Made with <Heart className="h-3.5 w-3.5 fill-mint text-mint" aria-hidden /> by{" "}
            <a
              href="https://bytesplatform.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/70 transition-colors hover:text-mint"
            >
              Bytes Platform
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
