import { ArrowRight, Check } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ParallaxMedia } from "@/components/animation/ParallaxMedia";
import { ProviderPortalPreview } from "@/components/product/ProviderPortalPreview";
import { SpecialtyTag } from "@/components/ui/SpecialtyTag";
import { cn } from "@/lib/utils";

function Row({
  reverse,
  badge,
  badgeTone,
  title,
  points,
  tags,
  cta,
  secondary,
  variant,
  media,
}: {
  reverse?: boolean;
  badge: string;
  badgeTone: "teal" | "navy";
  title: string;
  points: string[];
  tags?: string[];
  cta: { label: string; href: string };
  secondary: { label: string; href: string };
  variant: "primary" | "secondary";
  media: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <Reveal className={cn(reverse && "lg:order-2")}>
        <Badge tone={badgeTone}>{badge}</Badge>
        <h3 className="mt-4 font-display text-[clamp(1.7rem,3.2vw,2.5rem)] font-medium leading-tight text-navy">{title}</h3>
        <ul className="mt-5 flex flex-col gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-slate-ink">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {tags && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <SpecialtyTag key={t} label={t} variant="gold" />
            ))}
          </div>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button href={cta.href} variant={variant}>
            {cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button href={secondary.href} variant="ghost">{secondary.label}</Button>
        </div>
      </Reveal>
      <div className={cn(reverse && "lg:order-1")}>{media}</div>
    </div>
  );
}

export function AudiencePreview() {
  return (
    <Section id="audiences" tone="ice" density="normal">
      <div className="flex flex-col gap-16 lg:gap-24">
        <Row
          badge="For Bed Seekers"
          badgeTone="teal"
          title="Find the right care for someone you love"
          points={[
            "RN review for medications, wandering, safety, and memory needs",
            "Dementia and Alzheimer's placement guidance",
            "Mental & behavioral health placement support",
            "Guided tours and follow-up — at $0 cost to families",
          ]}
          cta={{ label: "Find Care", href: "/families#find-a-bed" }}
          secondary={{ label: "For Families", href: "/families" }}
          variant="primary"
          media={
            <div className="relative">
              <ParallaxMedia src="/assets/images/family-portrait.jpg" alt="A multigenerational family" className="aspect-[4/3] w-full shadow-card" speed={10} />
              <div className="absolute -bottom-5 left-4 max-w-[15rem] rounded-2xl border border-navy/10 bg-white p-4 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Intake started</p>
                <p className="mt-1 text-sm font-medium text-navy">Care level, funding & timeline captured — RN assessment next.</p>
              </div>
            </div>
          }
        />

        <Row
          reverse
          badge="For Bed Providers"
          badgeTone="navy"
          title="Fill vacancies with residents who truly fit"
          points={[
            "Showcase specialties, real-time availability, and pricing",
            "RN-reviewed, better-fit inquiries — fewer wasted tours",
            "Digitized intake, license verification, and an inquiry queue",
          ]}
          tags={["Behavioral Health", "Alzheimer's Care", "Psychiatric Support", "Dementia", "Memory Care", "Medication Support"]}
          cta={{ label: "List Your Beds", href: "/providers#list-your-beds" }}
          secondary={{ label: "For Providers", href: "/providers" }}
          variant="secondary"
          media={<ProviderPortalPreview />}
        />
      </div>
    </Section>
  );
}
