import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResidentialProviderCard } from "@/lib/platform/content";
import { CareTypePill, FundingPill, LocationChip } from "./pills";

/**
 * A published residential-provider card, driven entirely by the public
 * directory API — the same source as `/residential-providers`.
 *
 * Only fields the platform actually holds are shown. Bed availability, match
 * scores, RN-review status and price bands were previously rendered from demo
 * data with no backend behind them: capacity is deliberately private in the
 * public serializer, and the other three have no source at all, so the card no
 * longer claims them rather than inventing values.
 */
export function MarketplaceBedCard({
  provider,
  className,
}: {
  provider: ResidentialProviderCard;
  className?: string;
}) {
  const location = [provider.city, provider.state].filter(Boolean).join(", ");
  // The first service category doubles as the community "type" badge the design
  // shows over the image (Adult Family Home, Memory Care, …).
  const [primaryService, ...rest] = provider.services;
  // The strip is a narrow, fixed-height card: cap the pills so a provider with
  // a long service list cannot push the layout around.
  const otherServices = rest.slice(0, 2);
  const paymentTypes = provider.paymentTypes.slice(0, 3);

  return (
    <Link
      href={`/residential-providers/${provider.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-navy/10 bg-ivory shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-coral/50 hover:shadow-[0_34px_80px_-34px_rgba(181,111,40,0.55)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral",
        className,
      )}
    >
      <div className="relative h-44 overflow-hidden bg-sage/60">
        {provider.imageUrl ? (
          <Image
            src={provider.imageUrl}
            alt={`${provider.name}${primaryService ? ` — ${primaryService}` : ""}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width:768px) 90vw, 360px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ice to-sand" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-transparent to-transparent" />
        {primaryService ? (
          <div className="absolute bottom-3 left-3">
            <CareTypePill label={primaryService} className="bg-white/90" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-medium text-navy">{provider.name}</h3>
          {location ? (
            <div className="mt-1">
              <LocationChip city={location} />
            </div>
          ) : null}
        </div>

        {provider.summary ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-ink">{provider.summary}</p>
        ) : null}

        {otherServices.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {otherServices.map((s) => (
              <CareTypePill key={s} label={s} />
            ))}
          </div>
        ) : null}

        {paymentTypes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {paymentTypes.map((f) => (
              <FundingPill key={f} label={f} />
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-end border-t border-navy/10 pt-4">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-coral transition-colors group-hover:text-coral-600">
            View community <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
