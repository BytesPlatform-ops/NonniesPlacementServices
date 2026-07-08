import { MapPin, Stethoscope, BadgeDollarSign, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { WashingtonMap } from "@/components/product/WashingtonMap";

const POINTS = [
  { icon: Stethoscope, title: "RN-led, behavioral & medical", text: "Every referral gets a clinical review by a Registered Nurse experienced across medical and behavioral health." },
  { icon: BadgeDollarSign, title: "$0 cost to families", text: "Placement into our network of long-term and respite care providers is free for families." },
  { icon: ShieldCheck, title: "Licensed & verified", text: "Provider licenses are validated via state systems before any family is connected." },
];

export function ServiceAreaBand() {
  return (
    <Section id="service-area" tone="dark" density="normal">
      <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionHeading
            eyebrow="Washington care network"
            tone="dark"
            title="One RN-led network, all across Washington"
            description="Based in Tacoma, serving families, hospitals, and communities in 39 counties — from Seattle and Olympia to Spokane and the Tri-Cities."
          />
          <Reveal stagger={0.1} className="mt-8 flex flex-col gap-4">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} data-reveal className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>

        <Reveal className="relative">
          <div className="rounded-[2rem] border border-white/10 bg-midnight-800/60 p-6 backdrop-blur-sm">
            <div className="aspect-[100/62] w-full">
              <WashingtonMap tone="dark" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-mint" aria-hidden /> HQ · Tacoma, WA
              </span>
              <span>39 counties · live network</span>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
