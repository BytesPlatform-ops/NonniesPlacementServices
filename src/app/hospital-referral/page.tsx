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
    <section className="relative overflow-hidden bg-ice pt-32 pb-16 sm:pt-36 sm:pb-24">
      {/* Soft ambient light so the secure portal keeps a calm, clinical feel. */}
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-teal/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-blue/10 blur-3xl" />

      <Container className="relative">
        <div className="mx-auto max-w-6xl">
          {/* Intro + compliance text — full width on top. */}
          <div className="max-w-[820px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Secure Portal
              </Badge>
              <Badge tone="navy">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> HIPAA Compliant Interface
              </Badge>
            </div>

            <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.1rem)] font-medium leading-[1.05] tracking-tight text-navy text-balance">
              Secure Hospital Placement Portal
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-teal">
              WA State Care Transition Network
            </p>

            <p className="mt-4 text-lg leading-relaxed text-slate-ink text-pretty">
              A streamlined, single-screen referral for hospital case managers and social workers
              operating under acute discharge timelines.
            </p>

            <p className="mt-4 text-base leading-relaxed text-slate-ink">
              Our RN-led clinical placement pipeline operates in strict accordance with{" "}
              <strong className="font-semibold text-navy">RCW 70.41.320</strong> patient discharge
              guidelines and <strong className="font-semibold text-navy">RCW 70.41.322</strong> lay
              caregiver notification mandates. Patient choice is documented.
            </p>
          </div>

          {/* Compliance messaging band — built for professional trust with case managers. */}
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-teal/25 bg-white/70 p-4 shadow-soft">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            <p className="text-sm leading-relaxed text-slate-ink">
              Our RN team understands the{" "}
              <strong className="font-semibold text-navy">RCW 70.41.320 hospital discharge guidelines</strong>{" "}
              and coordinates every transition around them — so discharge planners and hospital case
              managers can move quickly with clinical and regulatory confidence.
            </p>
          </div>

          {/* Form — full width below the intro. */}
          <div className="mt-10">
            <HospitalReferralForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
