import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CARE_TYPE_CARDS } from "@/data/careTypes";

export function CareTypesGrid({
  id = "care-types",
  count = 8,
  showAll = false,
}: {
  id?: string;
  count?: number;
  showAll?: boolean;
}) {
  const cards = showAll ? CARE_TYPE_CARDS : CARE_TYPE_CARDS.slice(0, count);
  return (
    <Section id={id} density="normal">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Care we support"
          title="Every level of care has a place"
          description="From adult family homes to skilled nursing, behavioral health, and hospice — matched to real clinical needs across Washington State."
        />
        {!showAll && (
          <Reveal>
            <Button href="/families#care-types" variant="ghost">
              See all 12 care types <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Reveal>
        )}
      </div>

      <Reveal stagger={0.07} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <article
              key={c.title}
              data-reveal
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-3xl border border-navy/10 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card",
                c.image ? "min-h-[15rem] text-white" : "bg-white p-6",
              )}
            >
              {c.image ? (
                <>
                  <Image src={c.image} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:768px) 100vw, 25vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/40 to-midnight/10" />
                  <div className="relative mt-auto p-5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-3 font-display text-lg font-medium">{c.title}</h3>
                    <p className="mt-1 text-sm text-white/75 line-clamp-2">{c.description}</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-ice text-blue transition-colors group-hover:bg-teal/15 group-hover:text-teal">
                    <Icon className="h-5.5 w-5.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-medium text-navy">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-ink">{c.description}</p>
                </>
              )}
            </article>
          );
        })}
      </Reveal>
    </Section>
  );
}
