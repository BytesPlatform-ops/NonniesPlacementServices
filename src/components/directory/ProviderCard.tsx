import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { ResidentialProviderCard } from "@/lib/platform/content";

/** Editorial, image-led residential-provider card in the warm card language. */
export function ProviderCard({ provider }: { provider: ResidentialProviderCard }) {
  const location = [provider.city, provider.state].filter(Boolean).join(", ");
  const services = provider.services.slice(0, 3);
  const extra = provider.services.length - services.length;

  return (
    <Link
      href={`/residential-providers/${provider.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-navy/10 bg-white shadow-soft transition-shadow duration-300 hover:shadow-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-ice">
        {provider.imageUrl ? (
          <Image
            src={provider.imageUrl}
            alt={provider.name}
            fill
            loading="lazy"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ice to-sand" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-xl font-medium leading-snug text-navy">{provider.name}</h3>
          {location ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-ink/80">
              <MapPin className="h-3.5 w-3.5 text-coral" aria-hidden /> {location}
            </p>
          ) : null}
        </div>

        {provider.summary ? <p className="line-clamp-3 text-sm leading-relaxed text-slate-ink">{provider.summary}</p> : null}

        {services.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span key={s} className="rounded-full bg-ice px-2.5 py-0.5 text-[11px] font-medium text-navy">
                {s}
              </span>
            ))}
            {extra > 0 ? <span className="rounded-full px-1 py-0.5 text-[11px] font-medium text-slate-ink/70">+{extra} more</span> : null}
          </div>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-coral">
          View community <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
