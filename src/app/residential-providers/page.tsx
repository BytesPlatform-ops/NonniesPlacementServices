import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/animation/Reveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ProviderCard } from "@/components/directory/ProviderCard";
import { DirectoryFilters } from "@/components/directory/DirectoryFilters";
import { fetchResidentialOptions, fetchResidentialProviders } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Residential Care Directory",
  description:
    "Browse trusted residential care communities — adult family homes, assisted living, memory care and more — listed with Nonni's Placement Services.",
  alternates: { canonical: "/residential-providers" },
  openGraph: {
    title: "Residential Care Directory · Nonni's Placement Services",
    description: "Browse trusted residential care communities listed with Nonni's Placement Services.",
    type: "website",
    url: "/residential-providers",
  },
};

// Fetched from the platform; refresh periodically so newly published listings appear.
export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function ResidentialProvidersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = {
    q: one(sp.q),
    state: one(sp.state),
    city: one(sp.city),
    serviceCategory: one(sp.serviceCategory),
    language: one(sp.language),
    paymentType: one(sp.paymentType),
    sort: one(sp.sort),
    page: Number(one(sp.page) ?? "1") || 1,
  };

  const [directory, options] = await Promise.all([fetchResidentialProviders(query), fetchResidentialOptions()]);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = one(v);
      if (value && k !== "page") params.set(k, value);
    }
    if (page > 1) params.set("page", String(page));
    return params.toString() ? `/residential-providers?${params.toString()}` : "/residential-providers";
  };

  return (
    <>
      <PageHero
        eyebrow="For Families"
        title="Find residential care you can trust"
        description="Browse residential communities in the Nonni's network — assisted living, adult family homes, memory care and more. Every listing is a real community; our RN-led team can help you take the next step."
        primary={{ label: "Talk to an RN", href: "tel:2533848822" }}
        secondary={{ label: "How Nonni's helps", href: "/families" }}
      />

      <Section tone="light" density="normal">
        <DirectoryFilters options={options} total={directory.total} />

        <div className="mt-8">
          {directory.items.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-[26px] border border-navy/10 bg-white p-10 text-center shadow-soft">
              <h2 className="font-display text-2xl font-medium text-navy">Let&rsquo;s find the right community together</h2>
              <p className="mt-3 text-slate-ink">
                We couldn&rsquo;t find communities matching those filters right now. Our care team knows the local network well and
                can hand-match options to your family&rsquo;s needs.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="tel:2533848822" className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-coral-600">
                  Talk to an RN
                </Link>
                <Link href="/families#find-a-bed" className="rounded-full border border-navy/15 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-ice">
                  Tell us what you need
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 hidden text-sm text-slate-ink/70 sm:block">
                {directory.total} {directory.total === 1 ? "community" : "communities"}
              </p>
              <Reveal stagger={0.06} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {directory.items.map((provider) => (
                  <div key={provider.slug} data-reveal>
                    <ProviderCard provider={provider} />
                  </div>
                ))}
              </Reveal>

              {directory.totalPages > 1 ? (
                <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="Directory pagination">
                  {query.page > 1 ? (
                    <Link href={pageHref(query.page - 1)} className="rounded-full border border-navy/15 px-4 py-2 font-medium text-navy hover:bg-ice">
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-full border border-navy/10 px-4 py-2 font-medium text-slate-ink/40">Previous</span>
                  )}
                  <span className="text-slate-ink/70">
                    Page {directory.page} of {directory.totalPages}
                  </span>
                  {query.page < directory.totalPages ? (
                    <Link href={pageHref(query.page + 1)} className="rounded-full border border-navy/15 px-4 py-2 font-medium text-navy hover:bg-ice">
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-full border border-navy/10 px-4 py-2 font-medium text-slate-ink/40">Next</span>
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-slate-ink/70">
          Are you a care provider?{" "}
          <Link href="/providers#list-your-beds" className="font-semibold text-coral hover:underline">
            List your community
          </Link>
        </p>
      </Section>

      <FinalCTA />
    </>
  );
}
