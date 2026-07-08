import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/data/listings";
import { CareTypePill, FundingPill, RNReviewedBadge, LocationChip, AvailabilityBadge, MatchScoreBadge } from "./pills";

/** A marketplace provider/bed listing card — image, availability, match ring, RN badge, funding. */
export function MarketplaceBedCard({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-navy/10 bg-ivory shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-coral/50 hover:shadow-[0_34px_80px_-34px_rgba(181,111,40,0.55)]",
        className,
      )}
    >
      <div className="relative h-44 overflow-hidden">
        <Image src={listing.image} alt={`${listing.name} — ${listing.type}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:768px) 90vw, 360px" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          <AvailabilityBadge beds={listing.bedsAvailable} />
        </div>
        <div className="absolute right-3 top-3">
          {listing.rnReviewed && <RNReviewedBadge />}
        </div>
        <div className="absolute bottom-3 left-3">
          <CareTypePill label={listing.type} className="bg-white/90" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-medium text-navy">{listing.name}</h3>
            <div className="mt-1">
              <LocationChip city={listing.city} />
            </div>
          </div>
          <MatchScoreBadge score={listing.matchScore} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {listing.care.map((c) => <CareTypePill key={c} label={c} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {listing.funding.map((f) => <FundingPill key={f} label={f} />)}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-navy/10 pt-4">
          <span className="text-sm font-semibold text-navy">{listing.price} <span className="font-normal text-slate-ink">/ mo</span></span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-coral transition-colors group-hover:text-coral-600">
            View match <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
