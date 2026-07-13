import type { Metadata } from "next";
import { ShieldCheck, Lock, Scale } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { HospitalReferralForm } from "@/components/forms/HospitalReferralForm";

export const metadata: Metadata = {
  title: "Submit a Facilities Referral",
  description:
    "Secure Hospital Placement Portal for the WA State Care Transition Network. RN-led clinical placement operating in accordance with RCW 70.41.320 discharge and RCW 70.41.322 lay caregiver notification guidelines.",
  robots: { index: false, follow: false },
};

export default function HospitalReferralPage() {
  return (
    <>
      {/* Dark umber hero — intro + compliance text on top. */}
      <section className="relative overflow-hidden bg-midnight pt-32 pb-16 text-white sm:pt-36">
        <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-midnight/45" />

        <Container className="relative">
          <div className="max-w-[820px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="mint">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Secure Portal
              </Badge>
              <Badge tone="neutral">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> HIPAA Compliant Interface
              </Badge>
            </div>

            <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.1rem)] font-medium leading-[1.05] tracking-tight text-white text-balance">
              Secure Hospital Placement Portal
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-mint">
              WA State Care Transition Network
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/75 text-pretty">
              A streamlined, single-screen referral for hospital case managers and social workers
              operating under acute discharge timelines.
            </p>

            <p className="mt-4 text-base leading-relaxed text-white/70">
              Our RN-led clinical placement pipeline operates in strict accordance with{" "}
              <strong className="font-semibold text-white">RCW 70.41.320</strong> patient discharge
              guidelines and <strong className="font-semibold text-white">RCW 70.41.322</strong> lay
              caregiver notification mandates. Patient choice is documented.
            </p>
          </div>

          {/* Compliance messaging band — built for professional trust with case managers. */}
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-mint/25 bg-white/5 p-4 backdrop-blur-sm">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden />
            <p className="text-sm leading-relaxed text-white/85">
              Our RN team understands the{" "}
              <strong className="font-semibold text-white">RCW 70.41.320 hospital discharge guidelines</strong>{" "}
              and coordinates every transition around them — so discharge planners and hospital case
              managers can move quickly with clinical and regulatory confidence.
            </p>
          </div>
        </Container>
      </section>

      {/* Form — full width below the hero, on a calm light surface. */}
      <section className="bg-porcelain py-14 sm:py-20">
        <Container>
          <div className="mx-auto max-w-6xl">
            <HospitalReferralForm />
          </div>
        </Container>
      </section>
    </>
  );
}
