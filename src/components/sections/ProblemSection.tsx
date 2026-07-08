import Image from "next/image";
import { Clock, SearchX, Phone, FileWarning, BedDouble, Database } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";

const DEMAND = {
  label: "Discharge offices & families",
  image: "/assets/images/elderly-hands-care.jpg",
  alt: "A young hand holding an older person's hand",
  pains: [
    { icon: Clock, text: "A discharge clock ticking — days, not weeks, to find a safe, appropriate placement." },
    { icon: Phone, text: "Countless calls and visits to facilities that are full, out of budget, or the wrong level of care." },
    { icon: SearchX, text: "Minimal data transparency on options, pricing, and who can truly meet complex needs." },
  ],
};

const SUPPLY = {
  label: "Community providers",
  image: "/assets/images/provider-facility-care.jpg",
  alt: "A caregiver serving a resident in a care community",
  pains: [
    { icon: BedDouble, text: "Open beds sitting empty while the right residents never learn the community exists." },
    { icon: FileWarning, text: "Mismatched inquiries — wrong care level, wrong funding, wasted tours and staff time." },
    { icon: Database, text: "No real-time view of demand, patient funding models, or client-centric preferences." },
  ],
};

function Column({ data }: { data: typeof DEMAND }) {
  return (
    <Reveal stagger={0.12} className="overflow-hidden rounded-[2rem] border border-navy/10 bg-white shadow-soft">
      <div data-reveal className="relative h-44">
        <Image src={data.image} alt={data.alt} fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight/80 via-midnight/20 to-transparent" />
        <p className="absolute bottom-4 left-5 font-display text-xl font-medium text-white">{data.label}</p>
      </div>
      <div className="space-y-3 p-6">
        {data.pains.map(({ icon: Icon, text }) => (
          <div key={text} data-reveal className="flex items-start gap-3.5 rounded-2xl bg-ice/50 p-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/10 text-coral">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[0.95rem] leading-relaxed text-slate-ink">{text}</p>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

export function ProblemSection() {
  return (
    <Section id="problem" tone="ice" density="normal">
      <SectionHeading
        eyebrow="The problem"
        badgeTone="coral"
        title="Care placement is fragmented on both sides"
        description="Patients requiring placement face a fragmented supply of communities; providers lack access to centralized, matched demand. The two rarely meet in time — especially for complex behavioral and medical needs."
        align="center"
        className="mx-auto"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Column data={DEMAND} />
        <Column data={SUPPLY} />
      </div>
    </Section>
  );
}
