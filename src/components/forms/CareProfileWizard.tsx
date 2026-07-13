"use client";

import { useRef, useState } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormSuccess } from "./FormSuccess";
import { DataSecurityNotice } from "./DataSecurityNotice";

/* -------------------------------------------------------------------------- */
/*  Options — transcribed exactly from the intake spec                         */
/* -------------------------------------------------------------------------- */

type Opt = { value: string; desc?: string };
const o = (value: string, desc?: string): Opt => ({ value, desc });

const FILLED_BY = [
  o("Family Member / Legal Guardian"),
  o("Hospital Discharge Planner"),
  o("Case Manager / Social Worker"),
];

// Values that trigger the high-priority (high_urgency) flag.
const LOCATION_HOSPITAL = "Hospital ER / Med-Surg Unit";
const TIMELINE_IMMEDIATE = "Immediate (Hospital Discharge / Emergency)";

const LOCATION = [
  o("At Home (Safe)"),
  o("At Home (In Crisis)"),
  o(LOCATION_HOSPITAL),
  o("Psychiatric Facility"),
  o("Rehab / Skilled Nursing Facility"),
];

const TIMELINE = [
  o(TIMELINE_IMMEDIATE),
  o("Within 1 to 2 Weeks"),
  o("Within 30 Days"),
  o("Planning for the Future"),
];

const COGNITIVE = [
  o("Alzheimer's Disease"),
  o("Dementia (Lewy Body, Vascular, Frontotemporal, etc.)"),
  o("Traumatic Brain Injury (TBI)"),
  o("No formal diagnosis, but experiencing severe short-term memory loss"),
];

const SAFETY = [
  o("Exit-Seeking / Wandering", "Attempts to leave the home environment or gets lost easily."),
  o("Sundowning", "Increased confusion, anxiety, or agitation in the late afternoon/evening."),
  o("Orientation", "Disoriented to time, place, or recognizing familiar family members."),
  o("Requires a fully secured, locked memory care perimeter or community structure."),
];

const MENTAL = [
  o("Chronic Depression / Anxiety"),
  o("Bipolar Disorder"),
  o("Schizophrenia / Schizoaffective Disorder"),
  o("PTSD (Post-Traumatic Stress Disorder)"),
  o("History of Substance Use / Addiction Support Needs"),
];

const BEHAVIORAL = [
  o("Verbal Aggression", "Frequent shouting, resistance to care routines, or repetitive vocalizations."),
  o("Physical Aggression", "Pushing, scratching, or combative behavior during hands-on care (bathing/dressing)."),
  o("Hallucinations / Delusions", "Sees or hears things that aren't there, or holds fixed false beliefs."),
  o("Hoarding / Shadows", "Collects items obsessively or exhibits intense pacing."),
];

const MOBILITY = [
  o("Walks independently"),
  o("Uses walker/wheelchair independently"),
  o("Requires 1-person physical assistance to stand/transfer"),
  o("Requires 2-person assistance or a mechanical lift (Hoyer Lift)"),
  o("Bedbound"),
];

const MEDICAL = [
  o("Insulin-Dependent Diabetes Management (Sliding scale / RN injection)"),
  o("Continuous Oxygen Therapy or CPAP"),
  o("Wound Care (Stage 2, 3, or 4 pressure ulcers)"),
  o("Catheter / Ostomy care management"),
  o("Hospice Care or Palliative Comfort Care services"),
];

const MEDICATION = [
  o("Manages own medications"),
  o("Needs reminders"),
  o("Requires full administration, crushing, or locked storage due to refusal or safety risks"),
];

const FINANCING = [
  o("Private Pay (Savings, home sale, assets)"),
  o("WA State Medicaid (Long-Term Care / COPES program active)"),
  o("Medicaid Pending (Financial spend-down currently in progress)"),
  o("VA Benefits (Aid & Attendance)"),
  o("Long-Term Care Insurance Policy"),
];

const BUDGET = [
  o("Under $4,000 / mo"),
  o("$4,000 to $6,000 / mo"),
  o("$6,000 to $8,000 / mo"),
  o("$8,000+ / mo"),
];

/* -------------------------------------------------------------------------- */
/*  Schema                                                                     */
/* -------------------------------------------------------------------------- */

// "Select all that apply" fields — coerce RHF's false/undefined/single into an array.
const multi = () =>
  z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string())).default([]);

const schema = z.object({
  // Step 1 — required for routing.
  filledBy: z.string().min(1, "Please choose one"),
  location: z.string().min(1, "Please choose one"),
  timeline: z.string().min(1, "Please choose one"),
  // Step 2
  cognitiveConditions: multi(),
  safetyBehaviors: multi(),
  // Step 3
  mentalHealth: multi(),
  behavioralExpressions: multi(),
  // Step 4
  mobility: z.string().min(1, "Please choose one"),
  medicalInterventions: multi(),
  medicationAssistance: z.string().min(1, "Please choose one"),
  // Step 5
  financing: multi(),
  budget: z.string().min(1, "Please choose one"),
});

type FormValues = z.input<typeof schema>;

const STEPS = [
  "The Basics",
  "Memory Support",
  "Behavioral Health",
  "Level of Care",
  "Financials",
] as const;

const STEP_FIELDS: (keyof FormValues)[][] = [
  ["filledBy", "location", "timeline"],
  [],
  [],
  ["mobility", "medicationAssistance"],
  ["budget"],
];

/* -------------------------------------------------------------------------- */
/*  Choice card — large, tappable radio / checkbox (minimal typing)            */
/* -------------------------------------------------------------------------- */

function ChoiceCard({
  type,
  option,
  reg,
}: {
  type: "radio" | "checkbox";
  option: Opt;
  reg: UseFormRegisterReturn;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-navy/15 bg-ivory p-3.5 transition-all duration-150",
        "hover:border-mint hover:bg-mint/[0.05]",
        "has-[:checked]:border-mint has-[:checked]:bg-mint/[0.10] has-[:checked]:ring-1 has-[:checked]:ring-mint/40",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral",
      )}
    >
      <input {...reg} type={type} value={option.value} className="peer sr-only" />
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-navy/30 bg-white transition-colors peer-checked:border-mint peer-checked:bg-mint",
          type === "radio" ? "rounded-full" : "rounded-md",
        )}
      >
        <Check className="h-3.5 w-3.5 text-white" aria-hidden />
      </span>
      <span className="text-sm leading-relaxed">
        <span className="font-medium text-navy">{option.value}</span>
        {option.desc && <span className="mt-0.5 block text-xs text-slate-ink/70">{option.desc}</span>}
      </span>
    </label>
  );
}

function Question({
  label,
  hint,
  error,
  children,
  span = 1,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  /** Span both columns of the form-body grid on desktop. */
  span?: 1 | 2;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col rounded-2xl bg-ice/40 p-4 ring-1 ring-navy/[0.08] sm:p-5", span === 2 && "lg:col-span-2")}>
      <legend className="px-1 text-sm font-semibold text-navy">{label}</legend>
      {hint && <p className="text-xs text-slate-ink/70">{hint}</p>}
      <div className={cn("mt-3 grid gap-2.5", span === 2 && "sm:grid-cols-2")}>{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wizard                                                                     */
/* -------------------------------------------------------------------------- */

export function CareProfileWizard() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [priority, setPriority] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      cognitiveConditions: [],
      safetyBehaviors: [],
      mentalHealth: [],
      behavioralExpressions: [],
      medicalInterventions: [],
      financing: [],
    },
  });

  // Conditional routing — flag high urgency the moment Step 1 signals it.
  const location = useWatch({ control, name: "location" });
  const timeline = useWatch({ control, name: "timeline" });
  const isHighUrgency = location === LOCATION_HOSPITAL || timeline === TIMELINE_IMMEDIATE;

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

  const onSubmit = async (data: FormValues) => {
    // Conditional logic rule: Hospital ER or Immediate → high_urgency status.
    const status =
      data.location === LOCATION_HOSPITAL || data.timeline === TIMELINE_IMMEDIATE
        ? "high_urgency"
        : "standard";
    const payload = { ...data, status };
    // Frontend only — backend wiring pending. Assembled profile (incl. status flag):
    console.info("[CareProfileWizard] submission", payload);
    setPriority(status === "high_urgency");
    await new Promise((r) => setTimeout(r, 600));
    setDone(true);
  };

  if (done) {
    return (
      <FormSuccess
        title="Profile locked in"
        message={
          priority
            ? "Flagged as high priority. An RN-led specialist would normally reach out within hours to coordinate an urgent placement."
            : "Thank you — an RN-led specialist would normally review this profile and reach out within one business day to begin matching."
        }
        onReset={() => {
          reset();
          setStep(0);
          setDone(false);
          setPriority(false);
        }}
      />
    );
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-card">
      {/* Header + persistent progress bar */}
      <div className="border-b border-navy/10 bg-gradient-to-r from-ice to-white px-6 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 text-teal">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy">Care profile · {STEPS[step]}</p>
              <p className="text-xs text-slate-ink/70">RN-led · $0 to families</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-teal">{progress}%</p>
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-ink/60">
              Step {step + 1}/{STEPS.length}
            </p>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-navy/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Form progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal to-gold transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Priority banner — conditional routing feedback */}
      {isHighUrgency && (
        <div className="flex items-start gap-2.5 border-b border-coral/20 bg-coral/[0.06] px-6 py-3 text-sm text-navy sm:px-8">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden />
          <p>
            <span className="font-semibold">Marked high priority.</span> This profile will be flagged
            for immediate RN outreach.
          </p>
        </div>
      )}

      <div className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
          <div ref={panelRef}>
            {/* Step 1 — The Basics */}
            {step === 0 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question label="Who is filling out this form?" error={errors.filledBy?.message}>
                  {FILLED_BY.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("filledBy")} />
                  ))}
                </Question>
                <Question label="Where is the individual currently located?" error={errors.location?.message}>
                  {LOCATION.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("location")} />
                  ))}
                </Question>
                <Question label="Target move-in timeline" error={errors.timeline?.message} span={2}>
                  {TIMELINE.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("timeline")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 2 — Cognitive & Memory Support */}
            {step === 1 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question
                  label="Does the individual have a diagnosed cognitive condition?"
                  hint="Select all that apply"
                >
                  {COGNITIVE.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("cognitiveConditions")} />
                  ))}
                </Question>
                <Question label="Safety & cognitive behaviors" hint="Select all that apply">
                  {SAFETY.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("safetyBehaviors")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 3 — Mental & Behavioral Health */}
            {step === 2 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question
                  label="Are there active mental health diagnoses requiring specialized tracking?"
                  hint="Select all that apply"
                >
                  {MENTAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("mentalHealth")} />
                  ))}
                </Question>
                <Question label="Current behavioral care expressions" hint="Select all that apply">
                  {BEHAVIORAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("behavioralExpressions")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 4 — Medical & Physical Level of Care */}
            {step === 3 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question label="Mobility support level" error={errors.mobility?.message}>
                  {MOBILITY.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("mobility")} />
                  ))}
                </Question>
                <Question label="Specialized medical interventions required" hint="Select all that apply">
                  {MEDICAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("medicalInterventions")} />
                  ))}
                </Question>
                <Question label="Medication assistance" error={errors.medicationAssistance?.message} span={2}>
                  {MEDICATION.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("medicationAssistance")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 5 — Financial Capabilities */}
            {step === 4 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question label="How will care be financed?" hint="Select all that apply">
                  {FINANCING.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("financing")} />
                  ))}
                </Question>
                <Question label="Estimated monthly care budget" error={errors.budget?.message}>
                  {BUDGET.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("budget")} />
                  ))}
                </Question>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3 border-t border-navy/10 pt-6">
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
                <Lock className="h-4 w-4" aria-hidden />
                {isSubmitting ? "Locking in…" : "Lock In Profile & Connect with an RN"}
              </Button>
            )}
          </div>

          <DataSecurityNotice className="border-t border-navy/10 pt-5" />
        </form>
      </div>
    </div>
  );
}
