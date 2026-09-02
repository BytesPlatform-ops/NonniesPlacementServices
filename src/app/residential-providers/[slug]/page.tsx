import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { jsonLdScript } from "@/lib/json-ld";
import { ArrowLeft, Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { fetchResidentialProvider } from "@/lib/platform/content";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const provider = await fetchResidentialProvider(slug);
  if (!provider) {
    return { title: "Community not found", robots: { index: false, follow: false } };
  }
  const location = [provider.city, provider.state].filter(Boolean).join(", ");
  const description = provider.description?.slice(0, 300) ?? `Residential care community${location ? ` in ${location}` : ""}.`;
  return {
    title: provider.name,
    description,
    alternates: { canonical: `/residential-providers/${provider.slug}` },
    openGraph: {
      title: `${provider.name} · Nonni's Placement Services`,
      description,
      type: "website",
      url: `/residential-providers/${provider.slug}`,
      ...(provider.imageUrl ? { images: [{ url: provider.imageUrl }] } : {}),
    },
  };
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default async function ResidentialProviderDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await fetchResidentialProvider(slug);
  if (!provider) notFound();

  const location = [provider.city, provider.state].filter(Boolean).join(", ");
  const address = [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ");

  // Conservative, accurate structured data — no ratings/reviews are fabricated.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider.name,
    ...(provider.description ? { description: provider.description } : {}),
    ...(provider.imageUrl ? { image: provider.imageUrl } : {}),
    ...(provider.phone ? { telephone: provider.phone } : {}),
    ...(provider.website ? { url: provider.website } : {}),
    ...(provider.addressLine1 || provider.city
      ? {
          address: {
            "@type": "PostalAddress",
            ...(provider.addressLine1 ? { streetAddress: provider.addressLine1 } : {}),
            ...(provider.city ? { addressLocality: provider.city } : {}),
            ...(provider.state ? { addressRegion: provider.state } : {}),
            ...(provider.postalCode ? { postalCode: provider.postalCode } : {}),
          },
        }
      : {}),
  };

  const openHours = provider.hours.filter((h) => !h.closed);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <header className="bg-ice pt-32 pb-10 sm:pt-36 sm:pb-12">
        <Container className="max-w-4xl">
          <Link href="/residential-providers" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-ink transition-colors hover:text-navy">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All communities
          </Link>
          <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.08] tracking-tight text-navy text-balance">
            {provider.name}
          </h1>
          {location ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-ink/80">
              <MapPin className="h-4 w-4 text-coral" aria-hidden /> {location}
            </p>
          ) : null}
        </Container>
      </header>

      {provider.imageUrl ? (
        <Container className="max-w-4xl">
          <div className="relative -mt-2 aspect-[16/9] w-full overflow-hidden rounded-[26px] border border-navy/10 bg-ice shadow-card sm:-mt-4">
            <Image src={provider.imageUrl} alt={provider.name} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 896px" />
          </div>
        </Container>
      ) : null}

      <Section tone="light" density="normal">
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {provider.description ? (
              <section>
                <h2 className="font-display text-2xl font-medium text-navy">About</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-ink">{provider.description}</p>
              </section>
            ) : null}

            {provider.services.length > 0 ? (
              <section>
                <h2 className="font-display text-2xl font-medium text-navy">Services &amp; care types</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {provider.services.map((s) => (
                    <div key={s.name} className="rounded-2xl border border-navy/10 bg-white p-4 shadow-soft">
                      <p className="font-medium text-navy">{s.name}</p>
                      {s.description ? <p className="mt-1 text-sm text-slate-ink">{s.description}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {provider.coverage.length > 0 ? (
              <section>
                <h2 className="font-display text-2xl font-medium text-navy">Service areas</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {provider.coverage.map((c) => (
                    <span key={c} className="rounded-full bg-ice px-3 py-1 text-sm text-navy">
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {provider.paymentTypes.length > 0 || provider.languages.length > 0 ? (
              <section className="grid gap-6 sm:grid-cols-2">
                {provider.paymentTypes.length > 0 ? (
                  <div>
                    <h2 className="font-display text-xl font-medium text-navy">Payment &amp; insurance</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.paymentTypes.map((p) => (
                        <span key={p} className="rounded-full bg-ice px-3 py-1 text-sm text-navy">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {provider.languages.length > 0 ? (
                  <div>
                    <h2 className="font-display text-xl font-medium text-navy">Languages</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.languages.map((l) => (
                        <span key={l} className="rounded-full bg-ice px-3 py-1 text-sm text-navy">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {openHours.length > 0 ? (
              <section>
                <h2 className="font-display text-2xl font-medium text-navy">Hours</h2>
                <ul className="mt-3 divide-y divide-navy/5 rounded-2xl border border-navy/10 bg-white shadow-soft">
                  {provider.hours.map((h) => (
                    <li key={h.day} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium text-navy">{DAY_LABEL[h.day] ?? h.day}</span>
                      <span className="text-slate-ink">
                        {h.closed ? "Closed" : h.open24 ? "Open 24 hours" : [h.opensAt, h.closesAt].filter(Boolean).join(" – ") || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* Contact / next step */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[26px] border border-navy/10 bg-white p-6 shadow-card">
              <h2 className="font-display text-xl font-medium text-navy">Contact &amp; next step</h2>
              <p className="mt-2 text-sm text-slate-ink">Our RN-led team can help you tour, compare and place with confidence.</p>

              <div className="mt-4 space-y-2 text-sm">
                {address ? (
                  <p className="flex items-start gap-2 text-slate-ink">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden /> {address}
                  </p>
                ) : null}
                {provider.phone ? (
                  <a href={`tel:${provider.phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 text-navy hover:text-coral">
                    <Phone className="h-4 w-4 text-coral" aria-hidden /> {provider.phone}
                  </a>
                ) : null}
                {provider.email ? (
                  <a href={`mailto:${provider.email}`} className="flex items-center gap-2 break-all text-navy hover:text-coral">
                    <Mail className="h-4 w-4 text-coral" aria-hidden /> {provider.email}
                  </a>
                ) : null}
                {provider.website ? (
                  <a href={provider.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-navy hover:text-coral">
                    <Globe className="h-4 w-4 text-coral" aria-hidden /> Visit website
                  </a>
                ) : null}
              </div>

              <div className="mt-5 space-y-2">
                <a href="tel:2533848822" className="block rounded-full bg-coral px-5 py-2.5 text-center text-sm font-semibold text-white shadow-soft hover:bg-coral-600">
                  Talk to an RN
                </a>
                <Link href="/families#find-a-bed" className="block rounded-full border border-navy/15 px-5 py-2.5 text-center text-sm font-semibold text-navy hover:bg-ice">
                  Request more information
                </Link>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-ink/60">
                <Clock className="h-3.5 w-3.5" aria-hidden /> Nonni&rsquo;s coordinates the next steps with you.
              </p>
            </div>
          </aside>
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
