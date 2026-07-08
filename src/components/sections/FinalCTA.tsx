import Image from "next/image";
import { Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/animation/MagneticButton";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/data/navigation";
import { CONTACT } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-midnight py-24 text-white sm:py-32">
      <Image
        src="/assets/images/hero-family-goldenhour.jpg"
        alt=""
        fill
        className="object-cover object-center opacity-40"
        sizes="100vw"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-midnight via-midnight/85 to-midnight/70" />
      <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-25" />
      <Container className="relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl font-display text-[clamp(2.2rem,5vw,3.75rem)] font-medium leading-[1.05] text-balance">
            Ready to find the <span className="gradient-text-mint">right placement?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/75 text-pretty">
            Start free — whether you&apos;re a family searching, a hospital discharging, or a provider
            with beds to fill. RN-led guidance is a step away.
          </p>
        </Reveal>
        <Reveal className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <MagneticButton>
            <Button href={PRIMARY_CTA.href} variant="dark" size="lg">
              {PRIMARY_CTA.label}
            </Button>
          </MagneticButton>
          <Button href={SECONDARY_CTA.href} variant="outline-light" size="lg">
            {SECONDARY_CTA.label}
          </Button>
        </Reveal>
        <Reveal className="mt-8">
          <a
            href={`tel:${CONTACT.phonePrimary}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <Phone className="h-4 w-4 text-mint" aria-hidden />
            Or call us directly — {CONTACT.phonePrimary}
          </a>
        </Reveal>
      </Container>
    </section>
  );
}
