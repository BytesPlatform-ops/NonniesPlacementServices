"use client";

import { useRef, useState, type BaseSyntheticEvent } from "react";
import { useForm, useWatch, type UseFormRegister, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormSuccess } from "./FormSuccess";
import { FormError } from "./FormError";
import { Honeypot } from "./Honeypot";
import { DataSecurityNotice } from "./DataSecurityNotice";
import { submitForm, field, readHoneypot, type SubmissionFieldItem } from "@/lib/forms/submitForm";

/* -------------------------------------------------------------------------- */
/*  Options — transcribed exactly from the intake spec                         */
/* -------------------------------------------------------------------------- */

type Opt = { value: string; desc?: string };
const o = (value: string, desc?: string): Opt => ({ value, desc });

// Every selectable question ends with an "Other" escape hatch; choosing it
// reveals a free-text field (see OtherInput) so nothing falls outside the list.
const OTHER = "Other";

const FILLED_BY = [
  o("Family Member / Legal Guardian"),
  o("Hospital Discharge Planner"),
  o("Case Manager / Social Worker"),
  o(OTHER),
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
  o(OTHER),
];

const TIMELINE = [
  o(TIMELINE_IMMEDIATE),
  o("Within 1 to 2 Weeks"),
  o("Within 30 Days"),
  o("Planning for the Future"),
  o(OTHER),
];

const COGNITIVE = [
  o("Alzheimer's Disease"),
  o("Dementia (Lewy Body, Vascular, Frontotemporal, etc.)"),
  o("Traumatic Brain Injury (TBI)"),
  o("No formal diagnosis, but experiencing severe short-term memory loss"),
  o(OTHER),
];

const SAFETY = [
  o("Exit-Seeking / Wandering", "Attempts to leave the home environment or gets lost easily."),
  o("Sundowning", "Increased confusion, anxiety, or agitation in the late afternoon/evening."),
  o("Orientation", "Disoriented to time, place, or recognizing familiar family members."),
  o("Requires a fully secured, locked memory care perimeter or community structure."),
  o(OTHER),
];

const MENTAL = [
  o("Chronic Depression / Anxiety"),
  o("Bipolar Disorder"),
  o("Schizophrenia / Schizoaffective Disorder"),
  o("PTSD (Post-Traumatic Stress Disorder)"),
  o("History of Substance Use / Addiction Support Needs"),
  o(OTHER),
];

const BEHAVIORAL = [
  o("Verbal Aggression", "Frequent shouting, resistance to care routines, or repetitive vocalizations."),
  o("Physical Aggression", "Pushing, scratching, or combative behavior during hands-on care (bathing/dressing)."),
  o("Hallucinations / Delusions", "Sees or hears things that aren't there, or holds fixed false beliefs."),
  o("Hoarding / Shadows", "Collects items obsessively or exhibits intense pacing."),
  o(OTHER),
];

const MOBILITY = [
  o("Walks independently"),
  o("Uses walker/wheelchair independently"),
  o("Requires 1-person physical assistance to stand/transfer"),
  o("Requires 2-person assistance or a mechanical lift (Hoyer Lift)"),
  o("Bedbound"),
  o(OTHER),
];

const MEDICAL = [
  o("Insulin-Dependent Diabetes Management (Sliding scale / RN injection)"),
  o("Continuous Oxygen Therapy or CPAP"),
  o("Wound Care (Stage 2, 3, or 4 pressure ulcers)"),
  o("Catheter / Ostomy care management"),
  o("Hospice Care or Palliative Comfort Care services"),
  o(OTHER),
];

const MEDICATION = [
  o("Manages own medications"),
  o("Needs reminders"),
  o("Requires full administration, crushing, or locked storage due to refusal or safety risks"),
  o(OTHER),
];

const FINANCING = [
  o("Private Pay (Savings, home sale, assets)"),
  o("WA State Medicaid (Long-Term Care / COPES program active)"),
  o("Medicaid Pending (Financial spend-down currently in progress)"),
  o("VA Benefits (Aid & Attendance)"),
  o("Long-Term Care Insurance Policy"),
  o(OTHER),
];

const BUDGET = [
  o("Under $4,000 / mo"),
  o("$4,000 to $6,000 / mo"),
  o("$6,000 to $8,000 / mo"),
  o("$8,000+ / mo"),
  o(OTHER),
];

/* -------------------------------------------------------------------------- */
/*  Schema                                                                     */
/* -------------------------------------------------------------------------- */

// "Select all that apply" fields — coerce RHF's false/undefined/single into an array.
const multi = () =>
  z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string())).default([]);

const schema = z
  .object({
    // Step 1 — required for routing.
    filledBy: z.string().min(1, "Please choose one"),
    filledByOther: z.string().optional(),
    location: z.string().min(1, "Please choose one"),
    locationOther: z.string().optional(),
    timeline: z.string().min(1, "Please choose one"),
    timelineOther: z.string().optional(),
    // Step 2
    cognitiveConditions: multi(),
    cognitiveConditionsOther: z.string().optional(),
    safetyBehaviors: multi(),
    safetyBehaviorsOther: z.string().optional(),
    // Step 3
    mentalHealth: multi(),
    mentalHealthOther: z.string().optional(),
    behavioralExpressions: multi(),
    behavioralExpressionsOther: z.string().optional(),
    // Step 4
    mobility: z.string().min(1, "Please choose one"),
    mobilityOther: z.string().optional(),
    medicalInterventions: multi(),
    medicalInterventionsOther: z.string().optional(),
    medicationAssistance: z.string().min(1, "Please choose one"),
    medicationAssistanceOther: z.string().optional(),
    // Step 5
    financing: multi(),
    financingOther: z.string().optional(),
    budget: z.string().min(1, "Please choose one"),
    budgetOther: z.string().optional(),
  })
  // When "Other" is chosen for a question, its free-text field is required.
  .superRefine((data, ctx) => {
    const d = data as Record<string, unknown>;
    const requireOther = (selected: boolean, otherKey: string) => {
      if (!selected) return;
      const v = d[otherKey];
      if (typeof v !== "string" || v.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please add a short description", path: [otherKey] });
      }
    };
    for (const k of ["filledBy", "location", "timeline", "mobility", "medicationAssistance", "budget"]) {
      requireOther(d[k] === OTHER, `${k}Other`);
    }
    for (const k of ["cognitiveConditions", "safetyBehaviors", "mentalHealth", "behavioralExpressions", "medicalInterventions", "financing"]) {
      const arr = d[k];
      requireOther(Array.isArray(arr) && arr.includes(OTHER), `${k}Other`);
    }
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
  ["filledBy", "filledByOther", "location", "locationOther", "timeline", "timelineOther"],
  ["cognitiveConditionsOther", "safetyBehaviorsOther"],
  ["mentalHealthOther", "behavioralExpressionsOther"],
  ["mobility", "mobilityOther", "medicalInterventionsOther", "medicationAssistance", "medicationAssistanceOther"],
  ["financingOther", "budget", "budgetOther"],
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
  other,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  /** Span both columns of the form-body grid on desktop. */
  span?: 1 | 2;
  /** Conditional "Other" free-text field, rendered below the options. */
  other?: React.ReactNode;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col rounded-2xl bg-ice/40 p-4 ring-1 ring-navy/[0.08] sm:p-5", span === 2 && "lg:col-span-2")}>
      <legend className="px-1 text-sm font-semibold text-navy">{label}</legend>
      {hint && <p className="text-xs text-slate-ink/70">{hint}</p>}
      <div className={cn("mt-3 grid gap-2.5", span === 2 && "sm:grid-cols-2")}>{children}</div>
      {other}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Free-text field revealed when a question's "Other" option is selected. */
function OtherInput({
  name,
  placeholder,
  register,
  error,
  multiline = false,
}: {
  name: keyof FormValues;
  placeholder: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  multiline?: boolean;
}) {
  const id = `other-${name}`;
  const base =
    "mt-3 w-full rounded-xl border border-navy/20 bg-ivory px-4 py-3 text-sm text-navy placeholder:text-slate-ink/55 " +
    "transition-[border-color,box-shadow] duration-150 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/25";
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      {multiline ? (
        <textarea id={id} rows={2} placeholder={placeholder} aria-invalid={!!error} className={cn(base, "resize-y", error && "border-coral")} {...register(name)} />
      ) : (
        <input id={id} type="text" placeholder={placeholder} aria-invalid={!!error} className={cn(base, error && "border-coral")} {...register(name)} />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wizard                                                                     */
/* -------------------------------------------------------------------------- */

export function CareProfileWizard() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
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

  // Watch all values — drives urgency routing and each question's "Other" reveal.
  const w = useWatch({ control });
  const isHighUrgency = w.location === LOCATION_HOSPITAL || w.timeline === TIMELINE_IMMEDIATE;
  const pickedOther = (v: unknown) => v === OTHER;
  const checkedOther = (v: unknown) => Array.isArray(v) && v.includes(OTHER);

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

  const onSubmit = async (data: FormValues, event?: BaseSyntheticEvent) => {
    setFailed(false);
    // Conditional logic rule: Hospital ER or Immediate → high_urgency status.
    const status =
      data.location === LOCATION_HOSPITAL || data.timeline === TIMELINE_IMMEDIATE
        ? "high_urgency"
        : "standard";
    // Only include an "Other" detail line when the user actually typed one.
    const opt = (label: string, value: unknown): SubmissionFieldItem | null =>
      value && String(value).trim() ? field(label, value) : null;
    const keep = (items: (SubmissionFieldItem | null)[]) => items.filter((x): x is SubmissionFieldItem => x !== null);

    try {
      await submitForm({
        formName: "Care Profile",
        honeypot: readHoneypot(event),
        raw: { ...data, status },
        sections: [
          {
            title: "The Basics",
            fields: keep([
              field("Who is filling out this form?", data.filledBy),
              opt("Other — role", data.filledByOther),
              field("Where is the individual currently located?", data.location),
              opt("Other — current setting", data.locationOther),
              field("Target move-in timeline", data.timeline),
              opt("Other — timeline", data.timelineOther),
              field("Urgency status", status === "high_urgency" ? "High priority" : "Standard"),
            ]),
          },
          {
            title: "Memory Support",
            fields: keep([
              field("Diagnosed cognitive condition", data.cognitiveConditions),
              opt("Other — cognitive condition", data.cognitiveConditionsOther),
              field("Safety & cognitive behaviors", data.safetyBehaviors),
              opt("Other — safety behavior", data.safetyBehaviorsOther),
            ]),
          },
          {
            title: "Behavioral Health",
            fields: keep([
              field("Active mental health diagnoses", data.mentalHealth),
              opt("Other — mental health", data.mentalHealthOther),
              field("Behavioral care expressions", data.behavioralExpressions),
              opt("Other — behavioral expression", data.behavioralExpressionsOther),
            ]),
          },
          {
            title: "Level of Care",
            fields: keep([
              field("Mobility support level", data.mobility),
              opt("Other — mobility", data.mobilityOther),
              field("Specialized medical interventions", data.medicalInterventions),
              opt("Other — medical intervention", data.medicalInterventionsOther),
              field("Medication assistance", data.medicationAssistance),
              opt("Other — medication", data.medicationAssistanceOther),
            ]),
          },
          {
            title: "Financials",
            fields: keep([
              field("How care will be financed", data.financing),
              opt("Other — financing", data.financingOther),
              field("Estimated monthly care budget", data.budget),
              opt("Other — budget", data.budgetOther),
            ]),
          },
        ],
      });
      setPriority(status === "high_urgency");
      setDone(true);
    } catch {
      setFailed(true);
    }
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
                <Question
                  label="Who is filling out this form?"
                  error={errors.filledBy?.message}
                  other={
                    pickedOther(w.filledBy) && (
                      <OtherInput name="filledByOther" placeholder="Please describe your role" register={register} error={errors.filledByOther?.message} />
                    )
                  }
                >
                  {FILLED_BY.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("filledBy")} />
                  ))}
                </Question>
                <Question
                  label="Where is the individual currently located?"
                  error={errors.location?.message}
                  other={
                    pickedOther(w.location) && (
                      <OtherInput name="locationOther" placeholder="Please describe the current setting" register={register} error={errors.locationOther?.message} />
                    )
                  }
                >
                  {LOCATION.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("location")} />
                  ))}
                </Question>
                <Question
                  label="Target move-in timeline"
                  error={errors.timeline?.message}
                  span={2}
                  other={
                    pickedOther(w.timeline) && (
                      <OtherInput name="timelineOther" placeholder="Please describe the timeline" register={register} error={errors.timelineOther?.message} />
                    )
                  }
                >
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
                  other={
                    checkedOther(w.cognitiveConditions) && (
                      <OtherInput name="cognitiveConditionsOther" placeholder="Please describe the cognitive condition" register={register} error={errors.cognitiveConditionsOther?.message} multiline />
                    )
                  }
                >
                  {COGNITIVE.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("cognitiveConditions")} />
                  ))}
                </Question>
                <Question
                  label="Safety & cognitive behaviors"
                  hint="Select all that apply"
                  other={
                    checkedOther(w.safetyBehaviors) && (
                      <OtherInput name="safetyBehaviorsOther" placeholder="Please describe the behavior" register={register} error={errors.safetyBehaviorsOther?.message} multiline />
                    )
                  }
                >
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
                  other={
                    checkedOther(w.mentalHealth) && (
                      <OtherInput name="mentalHealthOther" placeholder="Please describe the diagnosis" register={register} error={errors.mentalHealthOther?.message} multiline />
                    )
                  }
                >
                  {MENTAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("mentalHealth")} />
                  ))}
                </Question>
                <Question
                  label="Current behavioral care expressions"
                  hint="Select all that apply"
                  other={
                    checkedOther(w.behavioralExpressions) && (
                      <OtherInput name="behavioralExpressionsOther" placeholder="Please describe the behavior" register={register} error={errors.behavioralExpressionsOther?.message} multiline />
                    )
                  }
                >
                  {BEHAVIORAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("behavioralExpressions")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 4 — Medical & Physical Level of Care */}
            {step === 3 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question
                  label="Mobility support level"
                  error={errors.mobility?.message}
                  other={
                    pickedOther(w.mobility) && (
                      <OtherInput name="mobilityOther" placeholder="Please describe the mobility need" register={register} error={errors.mobilityOther?.message} />
                    )
                  }
                >
                  {MOBILITY.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("mobility")} />
                  ))}
                </Question>
                <Question
                  label="Specialized medical interventions required"
                  hint="Select all that apply"
                  other={
                    checkedOther(w.medicalInterventions) && (
                      <OtherInput name="medicalInterventionsOther" placeholder="Please describe the care need" register={register} error={errors.medicalInterventionsOther?.message} multiline />
                    )
                  }
                >
                  {MEDICAL.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("medicalInterventions")} />
                  ))}
                </Question>
                <Question
                  label="Medication assistance"
                  error={errors.medicationAssistance?.message}
                  span={2}
                  other={
                    pickedOther(w.medicationAssistance) && (
                      <OtherInput name="medicationAssistanceOther" placeholder="Please describe the medication need" register={register} error={errors.medicationAssistanceOther?.message} />
                    )
                  }
                >
                  {MEDICATION.map((opt) => (
                    <ChoiceCard key={opt.value} type="radio" option={opt} reg={register("medicationAssistance")} />
                  ))}
                </Question>
              </div>
            )}

            {/* Step 5 — Financial Capabilities */}
            {step === 4 && (
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
                <Question
                  label="How will care be financed?"
                  hint="Select all that apply"
                  other={
                    checkedOther(w.financing) && (
                      <OtherInput name="financingOther" placeholder="Please describe the funding source" register={register} error={errors.financingOther?.message} multiline />
                    )
                  }
                >
                  {FINANCING.map((opt) => (
                    <ChoiceCard key={opt.value} type="checkbox" option={opt} reg={register("financing")} />
                  ))}
                </Question>
                <Question
                  label="Estimated monthly care budget"
                  error={errors.budget?.message}
                  other={
                    pickedOther(w.budget) && (
                      <OtherInput name="budgetOther" placeholder="Please describe the budget" register={register} error={errors.budgetOther?.message} />
                    )
                  }
                >
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

          <Honeypot />
          <FormError show={failed} />
          <DataSecurityNotice className="border-t border-navy/10 pt-5" />
        </form>
      </div>
    </div>
  );
}
