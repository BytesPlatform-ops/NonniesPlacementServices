"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { FormSuccess } from "./FormSuccess";
import { DataSecurityNotice } from "./DataSecurityNotice";
import {
  FACILITY_TYPES,
  CARE_LEVELS,
  FUNDING_TYPES,
  BED_PREFERENCES,
  TIMELINES,
} from "@/data/careTypes";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  relationship: z.string().min(2, "Let us know your relationship"),
  location: z.string().min(2, "Enter a desired city or area"),
  facilityType: z.string().min(1, "Select a facility type"),
  careLevel: z.string().min(1, "Select a care level"),
  bedPreference: z.string().min(1, "Select a bed preference"),
  funding: z.string().min(1, "Select a funding type"),
  timeline: z.string().min(1, "Select a timeline"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  consent: z.literal(true, { message: "Please provide consent to continue" }),
});

type FormValues = z.infer<typeof schema>;

const STEPS = ["About you", "Care needs", "Details"] as const;
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["name", "email", "phone", "relationship"],
  ["location", "facilityType", "careLevel", "bedPreference"],
  ["funding", "timeline", "notes", "consent"],
];

export function FindBedForm() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !panelRef.current) return;
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, x: 24 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" },
      );
    },
    { dependencies: [step], scope: panelRef },
  );

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async () => {
    // Frontend only — simulate a brief submit, then show success.
    await new Promise((r) => setTimeout(r, 600));
    setDone(true);
  };

  if (done) {
    return (
      <FormSuccess
        title="Request received"
        message="Thanks — an RN-led placement specialist would normally reach out within one business day to begin your assessment."
        onReset={() => {
          reset();
          setStep(0);
          setDone(false);
        }}
      />
    );
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-card">
      {/* Product-onboarding header */}
      <div className="flex items-center justify-between gap-3 border-b border-navy/10 bg-gradient-to-r from-ice to-white px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 text-teal">
            <Send className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">New placement request</p>
            <p className="text-xs text-slate-ink/70">RN-led · $0 to families</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-teal">{progress}%</p>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-ink/60">Step {step + 1}/{STEPS.length}</p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <StepIndicator steps={[...STEPS]} current={step} />

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8" noValidate>
        <div ref={panelRef}>
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Your name" required error={errors.name?.message} autoComplete="name" {...register("name")} />
              <FormField label="Relationship to patient/resident" required hint="e.g. daughter, discharge planner" error={errors.relationship?.message} {...register("relationship")} />
              <FormField label="Email" type="email" required error={errors.email?.message} autoComplete="email" {...register("email")} />
              <FormField label="Phone" type="tel" required error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Desired location" required hint="City or area in Washington" error={errors.location?.message} {...register("location")} />
              <Select label="Facility type" required options={FACILITY_TYPES} error={errors.facilityType?.message} {...register("facilityType")} />
              <Select label="Care level" required options={CARE_LEVELS} error={errors.careLevel?.message} {...register("careLevel")} />
              <Select label="Bed preference" required options={BED_PREFERENCES} error={errors.bedPreference?.message} {...register("bedPreference")} />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="Funding / payment type" required options={FUNDING_TYPES} error={errors.funding?.message} {...register("funding")} />
              <Select label="Timeline / urgency" required options={TIMELINES} error={errors.timeline?.message} {...register("timeline")} />
              <Textarea
                label="Notes / special needs"
                className="sm:col-span-2"
                placeholder="Anything that would help us understand the situation — mobility, diagnoses, preferences…"
                error={errors.notes?.message}
                {...register("notes")}
              />
              <Checkbox
                className="sm:col-span-2"
                label="I consent to being contacted about this placement request."
                required
                error={errors.consent?.message}
                {...register("consent")}
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={back}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="secondary" onClick={next}>
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Submit request"} <Send className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>

        <DataSecurityNotice className="mt-6 border-t border-navy/10 pt-5" />
        </form>
      </div>
    </div>
  );
}
