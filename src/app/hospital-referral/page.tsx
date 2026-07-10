import type { Metadata } from "next";
import { ShieldCheck, Lock, Stethoscope, Scale } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
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
      {/* Secure portal banner layer */}
      <section className="relative overflow-hidden bg-midnight pt-32 pb-14 text-white sm:pt-36">
        <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-midnight/50" />
        <Container className="relative">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/12 bg-white/5 p-7 shadow-card backdrop-blur-md sm:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-mint ring-1 ring-mint/25">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Secure Portal
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/20">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> HIPAA Compliant Secure Interface
              </span>
            </div>

            <h1 className="mt-5 font-display text-[clamp(1.9rem,4vw,2.9rem)] font-medium leading-[1.05] tracking-tight text-white text-balance">
              Secure Hospital Placement Portal
            </h1>
            <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-mint">
              WA State Care Transition Network
            </p>

            <p className="mt-5 text-base leading-relaxed text-white/80">
              Our RN-led clinical placement pipeline operates in strict accordance with{" "}
              <span className="font-semibold text-white">RCW 70.41.320</span> patient discharge
              guidelines and <span className="font-semibold text-white">RCW 70.41.322</span> lay
              caregiver notification mandates. Patient choice is documented.
            </p>

            {/* Compliance messaging — built for professional trust with case managers. */}
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-mint/20 bg-mint/5 p-4">
              <Scale className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden />
              <p className="text-sm leading-relaxed text-white/85">
                Our RN team understands the{" "}
                <span className="font-semibold text-white">RCW 70.41.320 hospital discharge guidelines</span>{" "}
                and coordinates every transition around them — so discharge planners and hospital
                case managers can move quickly with clinical and regulatory confidence.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="ice" density="dense">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center gap-2.5 text-sm text-slate-ink">
            <Stethoscope className="h-4 w-4 text-teal" aria-hidden />
            <span>
              A streamlined, single-screen referral for case managers and social workers under acute
              discharge timelines.
            </span>
          </div>
          <HospitalReferralForm />
        </div>
      </Section>
    </>
  );
}
