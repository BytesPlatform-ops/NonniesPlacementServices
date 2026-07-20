import type { Metadata } from "next";
import { Phone, Mail, MapPin, Clock, Search, Building2, Zap } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { ContactForm } from "@/components/forms/ContactForm";
import { WashingtonMap } from "@/components/product/WashingtonMap";
import { CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach Nonni's Placement Services — RN-led care placement across Washington State. Based in Tacoma. Call (253) 384-8822.",
};

const CARDS = [
  { icon: Phone, label: "Call us", value: `${CONTACT.phonePrimary} · ${CONTACT.phoneSecondary}`, href: `tel:${CONTACT.phonePrimaryHref}` },
  { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: MapPin, label: "Office", value: CONTACT.address },
  { icon: Clock, label: "Hours", value: CONTACT.hours },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        tone="dark"
        title="Let's talk through the care you need"
        description="Whether you're a family beginning a search, a hospital coordinating a discharge, or a provider with beds to fill — we're here to help you take the next step. Based in Tacoma, serving all of Washington State."
        primary={{ label: "Find Care", href: "/families#find-a-bed" }}
        secondary={{ label: "List Your Beds", href: "/providers#list-your-beds" }}
        media={
          <div className="rounded-[2rem] border border-navy/10 bg-midnight p-6 shadow-card">
            <div className="aspect-[100/62] w-full">
              <WashingtonMap tone="dark" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-mint" aria-hidden /> HQ · Tacoma, WA</span>
              <span>Serving all of Washington</span>
            </div>
          </div>
        }
      />

      {/* Urgent placement band */}
      <div className="border-y border-coral/20 bg-coral/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-5 sm:flex-row sm:px-8 lg:px-12">
          <p className="flex items-center gap-2.5 text-sm font-medium text-navy">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coral/15 text-coral"><Zap className="h-4 w-4" aria-hidden /></span>
            Active or urgent hospital discharge? We prioritize time-sensitive placements.
          </p>
          <Button href={`tel:${CONTACT.phonePrimaryHref}`} variant="primary" size="sm">
            <Phone className="h-4 w-4" aria-hidden /> Call {CONTACT.phonePrimary}
          </Button>
        </div>
      </div>

      <Section id="contact-cards" density="normal">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Reach us" title="Ways to connect" description="Prefer a quick call? Reach out directly, or send a note and we'll get back to you within one business day." />

            <Reveal stagger={0.1} className="mt-8 grid gap-4 sm:grid-cols-2">
              {CARDS.map(({ icon: Icon, label, value, href }) => {
                const inner = (
                  <div data-reveal className="flex h-full items-start gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-soft transition-shadow hover:shadow-card">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ice text-blue">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-ink/70">{label}</p>
                      <p className="mt-1 break-words font-medium text-navy">{value}</p>
                    </div>
                  </div>
                );
                return href ? <a key={label} href={href} className="block">{inner}</a> : <div key={label}>{inner}</div>;
              })}
            </Reveal>

            <Reveal className="mt-6 flex flex-wrap gap-3">
              <Button href="/families#find-a-bed" variant="primary"><Search className="h-4 w-4" aria-hidden /> Find Care</Button>
              <Button href="/providers#list-your-beds" variant="secondary"><Building2 className="h-4 w-4" aria-hidden /> List Your Beds</Button>
            </Reveal>
          </div>

          <div id="inquiry">
            <ContactForm />
          </div>
        </div>
      </Section>
    </>
  );
}
