"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, Radar, ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MarketplaceBedCard } from "./MarketplaceBedCard";
import { LISTINGS } from "@/data/listings";
import { cn } from "@/lib/utils";

/** Live marketplace — auto-scrolling Embla carousel with arrow controls. */
export function BedMarketplaceStrip() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true },
    [Autoplay({ delay: 2600, stopOnInteraction: false, stopOnMouseEnter: true })],
  );
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    update();
    emblaApi.on("select", update).on("reInit", update);
  }, [emblaApi]);

  return (
    <section id="marketplace" className="relative overflow-hidden bg-sage/40 py-16 sm:py-[92px]" style={{ scrollMarginTop: "5rem" }}>
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <Badge tone="teal">
              <Radar className="h-3.5 w-3.5" aria-hidden /> Live availability
            </Badge>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-tight tracking-tight text-navy text-balance">
              Real beds, matched to real needs
            </h2>
            <p className="mt-2 text-slate-ink">RN-reviewed communities across Washington — live openings, funding, and match scores.</p>
          </div>
          {/* Arrow controls */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={prev} aria-label="Previous listings" className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition hover:border-navy/40 hover:bg-white", !canPrev && "opacity-40")}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={next} aria-label="Next listings" className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy/20 bg-ivory text-navy shadow-soft transition hover:border-navy/40 hover:bg-white", !canNext && "opacity-40")}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </Container>

      <Reveal className="mt-10">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-5 px-5 sm:px-8 lg:px-12">
            {LISTINGS.map((l) => (
              <div key={l.id} className="min-w-0 flex-[0_0_82%] sm:flex-[0_0_46%] lg:flex-[0_0_31%] xl:flex-[0_0_24%]">
                <MarketplaceBedCard listing={l} />
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Container>
        <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-ink/60">Demo listings — availability, pricing, and scores shown are illustrative.</p>
          <Button href="/families#find-a-bed" variant="ghost">
            Browse the full marketplace <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </Container>
    </section>
  );
}

/** Responsive grid of all listings (providers / browse pages). */
export function ProviderListingGrid({ id }: { id?: string }) {
  return (
    <div id={id}>
      <Reveal stagger={0.07}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LISTINGS.map((l) => (
            <div key={l.id} data-reveal>
              <MarketplaceBedCard listing={l} />
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
