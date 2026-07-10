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
import { PhotoUploadPlaceholder } from "./PhotoUploadPlaceholder";
import { DataSecurityNotice } from "./DataSecurityNotice";
import { FACILITY_TYPES, FUNDING_TYPES, BED_TYPES } from "@/data/careTypes";

const schema = z.object({
  communityName: z.string().min(2, "Enter your community name"),
  contactPerson: z.string().min(2, "Enter a contact person"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  license: z.string().min(2, "Enter your license number"),
  facilityType: z.string().min(1, "Select a facility type"),
  location: z.string().min(2, "Enter your location"),
  availableBeds: z
    .number({ message: "Enter a number of beds" })
    .int("Enter a whole number")
    .min(0, "Enter a number")
    .max(9999, "That seems too high"),
  bedType: z.string().min(1, "Select a bed type"),
  specialties: z.string().min(2, "List at least one specialty"),
  pricingRange: z.string().min(1, "Enter a pricing range"),
  funding: z.string().min(1, "Select accepted funding"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  consent: z.literal(true, { message: "Please provide consent to continue" }),
});

type FormValues = z.infer<typeof schema>;

const STEPS = ["Community", "Facility", "Details"] as const;
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["communityName", "contactPerson", "email", "phone", "license"],
  ["facilityType", "location", "availableBeds", "bedType", "specialties"],
  ["pricingRange", "funding", "notes", "consent"],
];

export function ListBedsForm() {
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
      gsap.fromTo(panelRef.current, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" });
    },
    { dependencies: [step], scope: panelRef },
  );

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async () => {
    await new Promise((r) => setTimeout(r, 600));
    setDone(true);
  };

  if (done) {
    return (
      <FormSuccess
        title="Listing submitted"
        message="Thanks — our team would normally verify your license and publish your community listing within two business days."
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
      <div className="flex items-center justify-between gap-3 border-b border-navy/10 bg-gradient-to-r from-ice to-white px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-navy/10 text-navy">
            <Send className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">List your community</p>
            <p className="text-xs text-slate-ink/70">License-verified · RN-reviewed inquiries</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-blue">{progress}%</p>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-ink/60">Step {step + 1}/{STEPS.length}</p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <StepIndicator steps={[...STEPS]} current={step} />

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8" noValidate>
        <div ref={panelRef}>
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Provider / community name" required error={errors.communityName?.message} {...register("communityName")} />
              <FormField label="Contact person" required error={errors.contactPerson?.message} autoComplete="name" {...register("contactPerson")} />
              <FormField label="Email" type="email" required error={errors.email?.message} autoComplete="email" {...register("email")} />
              <FormField label="Phone" type="tel" required error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
              <FormField label="License number" required className="sm:col-span-2" hint="Washington State care facility license" error={errors.license?.message} {...register("license")} />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="Facility type" required options={FACILITY_TYPES} error={errors.facilityType?.message} {...register("facilityType")} />
              <FormField label="Location" required hint="City or area in Washington" error={errors.location?.message} {...register("location")} />
              <FormField label="Beds currently available" type="number" min={0} required error={errors.availableBeds?.message} {...register("availableBeds", { valueAsNumber: true })} />
              <Select label="Primary bed type" required options={BED_TYPES} error={errors.bedType?.message} {...register("bedType")} />
              <FormField label="Specialties" required className="sm:col-span-2" hint="e.g. memory care, diabetic care, hospice-friendly" error={errors.specialties?.message} {...register("specialties")} />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Pricing range" required hint="e.g. $4,000–$6,500 / month" error={errors.pricingRange?.message} {...register("pricingRange")} />
              <Select label="Accepted funding / payment" required options={FUNDING_TYPES} error={errors.funding?.message} {...register("funding")} />
              <div className="sm:col-span-2">
                <PhotoUploadPlaceholder label="Community photos" />
              </div>
              <Textarea
                label="Notes"
                className="sm:col-span-2"
                placeholder="Anything else providers should know — staffing ratios, amenities, admission notes…"
                error={errors.notes?.message}
                {...register("notes")}
              />
              <Checkbox
                className="sm:col-span-2"
                label="I confirm I'm authorized to list this community."
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
              {isSubmitting ? "Sending…" : "Submit listing"} <Send className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>

        <DataSecurityNotice className="mt-6 border-t border-navy/10 pt-5" />
        </form>
      </div>
    </div>
  );
}
