import Image from "next/image";
import { MapPin, Star, Filter, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const COMMUNITIES = [
  { name: "Cedar Grove AFH", type: "Adult Family Home", city: "Bellevue", rating: 4.9, price: "$$", funding: "Private · LTC", image: "/assets/images/caregiver-resident-room.jpg" },
  { name: "Harborlight Assisted Living", type: "Assisted Living", city: "Tacoma", rating: 4.7, price: "$$$", funding: "Private · VA", image: "/assets/images/assisted-living-community.jpg" },
  { name: "Willow Bend Memory Care", type: "Memory Care", city: "Spokane", rating: 4.8, price: "$$$", funding: "Private · Medicaid", image: "/assets/images/care-lifestyle-1.jpg" },
  { name: "Rainier Skilled Nursing", type: "Skilled Nursing", city: "Seattle", rating: 4.6, price: "$$$$", funding: "Medicare · Medicaid", image: "/assets/images/provider-staff.jpg" },
  { name: "Evergreen Hospice House", type: "Hospice", city: "Olympia", rating: 5.0, price: "$$", funding: "Medicare · Private", image: "/assets/images/provider-facility-care.jpg" },
  { name: "Maple Court Respite", type: "Respite Care", city: "Vancouver", rating: 4.8, price: "$$", funding: "Private", image: "/assets/images/senior-family-consultation.jpg" },
];

const FILTERS = ["Specialty", "Price", "Funding", "Location", "Rating"];

export function BrowseCatalogue() {
  return (
    <Section id="browse">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Browse communities"
          title="A living catalogue of Washington care"
          description="Explore provider communities by specialty, price, funding accepted, and location. Every listing is reviewed for fit before families are connected."
        />
        <Reveal className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-sm font-semibold text-white">
            <Filter className="h-4 w-4" aria-hidden /> Filters
          </span>
          {FILTERS.map((f) => (
            <span key={f} className="rounded-full border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-slate-ink">
              {f}
            </span>
          ))}
        </Reveal>
      </div>

      <Reveal stagger={0.08} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {COMMUNITIES.map((c) => (
          <article
            key={c.name}
            data-reveal
            className="group overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            <div className="relative h-44 overflow-hidden">
              <Image src={c.image} alt={`${c.name} — ${c.type}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:768px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight/60 via-transparent to-transparent" />
              <div className="absolute left-4 top-4">
                <Badge tone="teal">{c.type}</Badge>
              </div>
              <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-coral text-coral" aria-hidden /> {c.rating}
              </div>
              <span className="absolute bottom-3 left-4 inline-flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[0.65rem] font-bold text-white">
                <ShieldCheck className="h-3 w-3" aria-hidden /> RN Reviewed
              </span>
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl font-medium text-navy">{c.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-ink">
                <MapPin className="h-4 w-4 text-blue" aria-hidden /> {c.city}, WA
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-navy/10 pt-4 text-sm">
                <span className="font-semibold text-navy">{c.price}</span>
                <span className="text-slate-ink">{c.funding}</span>
              </div>
            </div>
          </article>
        ))}
      </Reveal>

      <Reveal className="mt-10 text-center">
        <Button href="/families#find-a-bed" variant="primary" size="lg">
          Start a matched search
        </Button>
      </Reveal>
    </Section>
  );
}
