"use client";

import { useState, type BaseSyntheticEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Zap, Stethoscope, UserRound, ClipboardList, Wallet, HeartPulse, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSuccess } from "./FormSuccess";
import { FormError } from "./FormError";
import { Honeypot } from "./Honeypot";
import { DataSecurityNotice } from "./DataSecurityNotice";
import { SecureDocumentUpload, type StagedFileMeta } from "./SecureDocumentUpload";
import { submitForm, field, optionLabel, optionLabels, readHoneypot, type SubmissionFieldItem } from "@/lib/forms/submitForm";
import type { Option } from "@/data/careTypes";
import {
  DISCHARGE_URGENCY,
  CARE_DESTINATIONS,
  FINANCIAL_ROUTING,
  PATIENT_GENDERS,
  MOBILITY_LEVELS,
  ADL_LEVELS,
  YES_NO_UNSURE,
  NURSING_NEEDS,
  COGNITIVE_STATUS,
  BEHAVIORAL_CONCERNS,
  ASSISTIVE_DEVICES,
  ROOM_PREFERENCES,
  PRIVATE_PAY_BUDGETS,
  GUARDIAN_RELATIONSHIPS,
  type DriverOption,
} from "@/data/hospitalReferral";

// Checkbox groups arrive from RHF as arrays of checked values (defaultValues
// seed them to []), so they validate directly as string arrays.
const schema = z
  .object({
    // Professional contact
    referringName: z.string().min(2, "Enter the referring professional's name"),
    hospital: z.string().min(1, "Please enter the hospital or facility name."),
    location: z.string().min(2, "Enter a location or ZIP code"),
    phone: z.string().min(7, "Enter a direct phone or pager number"),
    email: z.string().email("Enter a valid secure business email"),

    // Patient baseline & placement area
    patientInitials: z.string().min(1, "Enter patient initials").max(3, "Maximum 3 characters"),
    age: z.string().min(1, "Enter patient age").max(3, "Enter a valid age"),
    gender: z.string().min(1, "Select a gender"),
    roomNumber: z.string().min(1, "Enter the current location / room number"),
    preferredArea: z.string().min(2, "Enter a preferred placement area"),
    dischargeWindow: z.string().min(1, "Select a target discharge date"),
    urgency: z.string().min(1, "Select a discharge urgency status"),

    // Clinical profile
    primaryDiagnosis: z.string().min(2, "Enter the primary diagnosis"),
    medicalConditions: z.string().max(1000).optional(),
    mobility: z.string().min(1, "Select a mobility level"),
    adl: z.string().min(1, "Select an ADL assistance level"),
    nurseDelegation: z.string().min(1, "Select an option"),
    cognitiveStatus: z.string().min(1, "Select a cognitive status"),
    nursingNeeds: z.array(z.string()),
    nursingNeedsOther: z.string().max(300).optional(),
    behavioralConcerns: z.array(z.string()),
    behavioralConcernsDetail: z.string().max(1000).optional(),
    fallRisk: z.string().min(1, "Select an option"),
    assistiveDevices: z.array(z.string()),
    oneToOne: z.string().min(1, "Select an option"),
    supervisionDetail: z.string().max(1000).optional(),

    // Placement preferences & drivers
    careDestinations: z.array(z.string()).min(1, "Select at least one care destination"),
    roomPreference: z.string().min(1, "Select a room preference"),
    financialRouting: z.array(z.string()).min(1, "Select at least one funding status"),
    financialRoutingOther: z.string().optional(),
    privatePayBudget: z.string().optional(),
    additionalConsiderations: z.string().max(1000).optional(),

    // Guardian / POA / family contact
    guardianName: z.string().optional(),
    guardianRelationship: z.string().optional(),
    guardianPhone: z.string().optional(),

    attestation: z.literal(true, { message: "Please confirm patient choice has been documented" }),
  })
  .superRefine((data, ctx) => {
    // "Other" financial status requires a short description.
    if (data.financialRouting.includes("other") && !data.financialRoutingOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["financialRoutingOther"], message: "Please tell us more." });
    }
    // Private pay requires an estimated monthly budget.
    if (data.financialRouting.includes("private-pay") && !data.privatePayBudget) {
      ctx.addIssue({ code: "custom", path: ["privatePayBudget"], message: "Select a private-pay budget." });
    }
    // "Other" nursing need requires a short description.
    if (data.nursingNeeds.includes("other") && !data.nursingNeedsOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["nursingNeedsOther"], message: "Please describe the nursing need." });
    }
  });

type FormValues = z.infer<typeof schema>;

/** Section header inside the single-screen form. */
function SectionLabel({ icon: Icon, title, children }: { icon: typeof Stethoscope; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-navy/10 pb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal/12 text-teal">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {children && <p className="text-xs text-slate-ink/70">{children}</p>}
      </div>
    </div>
  );
}

export function HospitalReferralForm() {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [referenceId, setReferenceId] = useState<string>();
  const [files, setFiles] = useState<StagedFileMeta[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      careDestinations: [],
      financialRouting: [],
      nursingNeeds: [],
      behavioralConcerns: [],
      assistiveDevices: [],
    },
  });

  // Conditional reveals keep the form short — sub-questions appear only when relevant.
  const financialRouting = useWatch({ control, name: "financialRouting" });
  const showFinancialOther = financialRouting?.includes("other") ?? false;
  const showPrivatePayBudget = financialRouting?.includes("private-pay") ?? false;
  const nursingNeeds = useWatch({ control, name: "nursingNeeds" });
  const showNursingOther = nursingNeeds?.includes("other") ?? false;
  const behavioralConcerns = useWatch({ control, name: "behavioralConcerns" });
  const showBehavioralDetail = behavioralConcerns?.some((v) => v !== "none") ?? false;
  const fallRisk = useWatch({ control, name: "fallRisk" });
  const showAssistiveDevices = fallRisk === "yes";
  const oneToOne = useWatch({ control, name: "oneToOne" });
  const showSupervisionDetail = oneToOne === "yes";

  const onSubmit = async (data: FormValues, event?: BaseSyntheticEvent) => {
    setFailed(false);

    const clinicalFields: SubmissionFieldItem[] = [
      field("Primary diagnosis", data.primaryDiagnosis),
      field("Relevant medical conditions", data.medicalConditions),
      { label: "Mobility / transfer level", value: optionLabel(MOBILITY_LEVELS, data.mobility) },
      { label: "ADL assistance level", value: optionLabel(ADL_LEVELS, data.adl) },
      { label: "Nurse delegation needed", value: optionLabel(YES_NO_UNSURE, data.nurseDelegation) },
      { label: "Cognitive / dementia status", value: optionLabel(COGNITIVE_STATUS, data.cognitiveStatus) },
      field("Skilled nursing needs", optionLabels(NURSING_NEEDS, data.nursingNeeds)),
      ...(data.nursingNeeds.includes("other") ? [field("Other nursing need", data.nursingNeedsOther)] : []),
      field("Behavioral & safety concerns", optionLabels(BEHAVIORAL_CONCERNS, data.behavioralConcerns)),
      ...(data.behavioralConcerns.some((v) => v !== "none")
        ? [field("Behavioral concern detail", data.behavioralConcernsDetail)]
        : []),
      { label: "Fall risk", value: optionLabel(YES_NO_UNSURE, data.fallRisk) },
      ...(data.fallRisk === "yes"
        ? [field("Assistive devices", optionLabels(ASSISTIVE_DEVICES, data.assistiveDevices))]
        : []),
      { label: "1:1 / supervision needs", value: optionLabel(YES_NO_UNSURE, data.oneToOne) },
      ...(data.oneToOne === "yes" ? [field("Supervision detail", data.supervisionDetail)] : []),
    ];

    const placementFields: SubmissionFieldItem[] = [
      field("Required care destination type", optionLabels(CARE_DESTINATIONS, data.careDestinations)),
      { label: "Room preference", value: optionLabel(ROOM_PREFERENCES, data.roomPreference) },
      field("Financial status routing", optionLabels(FINANCIAL_ROUTING, data.financialRouting)),
      ...(data.financialRouting.includes("private-pay")
        ? [{ label: "Private-pay budget", value: optionLabel(PRIVATE_PAY_BUDGETS, data.privatePayBudget) }]
        : []),
      ...(data.financialRouting.includes("other")
        ? [field("Other financial status", data.financialRoutingOther)]
        : []),
      field("Additional placement considerations", data.additionalConsiderations),
    ];

    try {
      const result = await submitForm({
        formName: "Hospital Referral",
        replyTo: data.email,
        honeypot: readHoneypot(event),
        files,
        raw: { ...data, uploadedDocuments: files.map(({ name, size, type }) => ({ name, size, type })) },
        sections: [
          {
            title: "Professional Contact Information",
            fields: [
              field("Referring professional name", data.referringName),
              field("Hospital / corporate facility", data.hospital),
              field("Location / ZIP code", data.location),
              field("Direct phone / pager contact", data.phone),
              field("Secure business email address", data.email),
            ],
          },
          {
            title: "Patient Baseline & Placement Area",
            fields: [
              field("Patient initials only", data.patientInitials),
              field("Age", data.age),
              { label: "Gender", value: optionLabel(PATIENT_GENDERS, data.gender) },
              field("Current location / room number", data.roomNumber),
              field("Preferred placement area", data.preferredArea),
              field("Target discharge window", data.dischargeWindow),
              { label: "Discharge urgency status", value: optionLabel(DISCHARGE_URGENCY, data.urgency) },
            ],
          },
          {
            title: "Clinical Profile",
            fields: clinicalFields,
          },
          {
            title: "Placement Preferences & Funding",
            fields: placementFields,
          },
          {
            title: "Guardian / POA / Family Contact",
            fields: [
              field("Contact name", data.guardianName),
              { label: "Relationship", value: optionLabel(GUARDIAN_RELATIONSHIPS, data.guardianRelationship) },
              field("Contact phone", data.guardianPhone),
            ],
          },
        ],
      });
      setReferenceId(result.referenceId);
      setDone(true);
    } catch {
      setFailed(true);
    }
  };

  if (done) {
    return (
      <FormSuccess
        title="Referral dispatched to RN clinical queue"
        message="Thanks — this referral would normally be routed to an RN for clinical review, with a placement specialist responding on an urgency-prioritized basis."
        referenceId={referenceId}
        onReset={() => {
          reset();
          setDone(false);
          setFiles([]);
          setReferenceId(undefined);
        }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-card">
      {/* Portal header */}
      <div className="flex items-center justify-between gap-3 border-b border-navy/10 bg-gradient-to-r from-ice to-white px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 text-teal">
            <Stethoscope className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">Hospital placement referral</p>
            <p className="text-xs text-slate-ink/70">RN-led clinical intake · urgency-prioritized</p>
          </div>
        </div>
        <span className="hidden rounded-full bg-navy/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-ink sm:inline-flex">
          Single-screen intake
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-9 p-6 sm:p-8" noValidate>
        {/* Professional contact information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={UserRound} title="Professional Contact Information" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Referring professional name" required error={errors.referringName?.message} autoComplete="name" {...register("referringName")} />
            <FormField label="Hospital / corporate facility" required placeholder="Enter hospital or facility name" error={errors.hospital?.message} autoComplete="organization" {...register("hospital")} />
            <FormField label="Location / ZIP code" required error={errors.location?.message} autoComplete="postal-code" {...register("location")} />
            <FormField label="Direct phone / pager contact" type="tel" required error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
            <FormField label="Secure business email address" type="email" required className="sm:col-span-2" error={errors.email?.message} autoComplete="email" {...register("email")} />
          </div>
        </fieldset>

        {/* Patient baseline & placement area */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={ClipboardList} title="Patient Baseline & Placement Area" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Patient initials only"
              required
              maxLength={3}
              hint="Maximum 3 characters — protects privacy before secure document vaulting"
              error={errors.patientInitials?.message}
              {...register("patientInitials")}
            />
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Age" required inputMode="numeric" maxLength={3} error={errors.age?.message} {...register("age")} />
              <Select label="Gender" required options={PATIENT_GENDERS} error={errors.gender?.message} {...register("gender")} />
            </div>
            <FormField label="Current location / room number" required error={errors.roomNumber?.message} {...register("roomNumber")} />
            <FormField label="Preferred placement area" required hint="City, region, or ZIP the family prefers" error={errors.preferredArea?.message} {...register("preferredArea")} />
            <FormField label="Target discharge window" type="date" required error={errors.dischargeWindow?.message} {...register("dischargeWindow")} />
            <div className="sm:col-span-2">
              <RadioCards
                name="urgency"
                label="Discharge urgency status"
                options={DISCHARGE_URGENCY}
                error={errors.urgency?.message}
                register={register}
              />
            </div>
          </div>
        </fieldset>

        {/* Clinical profile */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={HeartPulse} title="Clinical Profile">
            Only what&apos;s needed to match acuity — sub-questions appear as they apply.
          </SectionLabel>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Primary diagnosis"
              required
              className="sm:col-span-2"
              placeholder="e.g. CVA with left-side weakness"
              error={errors.primaryDiagnosis?.message}
              {...register("primaryDiagnosis")}
            />
            <Textarea
              label="Relevant medical conditions"
              className="sm:col-span-2"
              rows={2}
              placeholder="Comorbidities, recent procedures, precautions…"
              error={errors.medicalConditions?.message}
              {...register("medicalConditions")}
            />
            <Select label="Mobility / transfer level" required options={MOBILITY_LEVELS} error={errors.mobility?.message} {...register("mobility")} />
            <Select label="ADL assistance level" required options={ADL_LEVELS} error={errors.adl?.message} {...register("adl")} />
            <Select label="Nurse delegation needed" required options={YES_NO_UNSURE} error={errors.nurseDelegation?.message} {...register("nurseDelegation")} />
            <Select label="Cognitive / dementia status" required options={COGNITIVE_STATUS} error={errors.cognitiveStatus?.message} {...register("cognitiveStatus")} />
          </div>

          <PlainCheckGroup
            name="nursingNeeds"
            label="Skilled nursing needs"
            hint="Select all that apply — leave blank if none."
            options={NURSING_NEEDS}
            error={errors.nursingNeeds?.message}
            register={register}
          />
          {showNursingOther && (
            <FormField
              label="Other nursing need"
              placeholder="Please describe the nursing need"
              error={errors.nursingNeedsOther?.message}
              {...register("nursingNeedsOther")}
            />
          )}

          <PlainCheckGroup
            name="behavioralConcerns"
            label="Behavioral & safety concerns"
            hint="Select all that apply."
            options={BEHAVIORAL_CONCERNS}
            error={errors.behavioralConcerns?.message}
            register={register}
          />
          {showBehavioralDetail && (
            <Textarea
              label="Behavioral concern detail"
              rows={2}
              placeholder="Triggers, frequency, de-escalation that works…"
              error={errors.behavioralConcernsDetail?.message}
              {...register("behavioralConcernsDetail")}
            />
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Fall risk" required options={YES_NO_UNSURE} error={errors.fallRisk?.message} {...register("fallRisk")} />
            <Select label="1:1 / supervision needs" required options={YES_NO_UNSURE} error={errors.oneToOne?.message} {...register("oneToOne")} />
          </div>
          {showAssistiveDevices && (
            <PlainCheckGroup
              name="assistiveDevices"
              label="Assistive devices"
              hint="Devices currently in use."
              options={ASSISTIVE_DEVICES}
              error={errors.assistiveDevices?.message}
              register={register}
            />
          )}
          {showSupervisionDetail && (
            <Textarea
              label="Supervision detail"
              rows={2}
              placeholder="What level and reason for 1:1 / close supervision…"
              error={errors.supervisionDetail?.message}
              {...register("supervisionDetail")}
            />
          )}
        </fieldset>

        {/* Placement preferences & drivers */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Stethoscope} title="Placement Preferences & Funding" />
          <CheckGroup
            name="careDestinations"
            label="Required care destination type"
            hint="Select best fit — choose all that apply."
            options={CARE_DESTINATIONS}
            error={errors.careDestinations?.message}
            register={register}
          />
          <Select label="Private / shared room preference" required options={ROOM_PREFERENCES} error={errors.roomPreference?.message} {...register("roomPreference")} />

          <div className="flex items-center gap-2.5 border-b border-navy/10 pb-3 pt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal/12 text-teal">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-navy">Financial Status Routing</h3>
          </div>
          <CheckGroup
            name="financialRouting"
            label="Financial status routing"
            hideLabel
            options={FINANCIAL_ROUTING}
            error={errors.financialRouting?.message}
            register={register}
          />
          {/* Conditional "Other" detail — grid-rows collapse keeps the reveal smooth
              without measuring heights; inert removes it from tab order when hidden. */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity,transform,margin-top] duration-[250ms] ease-out motion-reduce:transition-none",
              showFinancialOther ? "grid-rows-[1fr] translate-y-0 opacity-100" : "-mt-5 grid-rows-[0fr] -translate-y-1.5 opacity-0",
            )}
            inert={!showFinancialOther}
            aria-hidden={!showFinancialOther}
          >
            <div className="min-h-0 overflow-hidden">
              <FormField
                label="Other financial status"
                placeholder="Please describe the financial status"
                required={showFinancialOther}
                className="p-1"
                error={errors.financialRoutingOther?.message}
                {...register("financialRoutingOther")}
              />
            </div>
          </div>
          {showPrivatePayBudget && (
            <Select
              label="Estimated private-pay budget"
              required
              options={PRIVATE_PAY_BUDGETS}
              error={errors.privatePayBudget?.message}
              {...register("privatePayBudget")}
            />
          )}

          <Textarea
            label="Additional placement considerations"
            rows={2}
            placeholder="Preferences, cultural / language needs, pets, proximity to family…"
            error={errors.additionalConsiderations?.message}
            {...register("additionalConsiderations")}
          />
        </fieldset>

        {/* Guardian / POA / family contact */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Users} title="Guardian / POA / Family Contact">
            Optional — helps coordinate tours and decisions.
          </SectionLabel>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Contact name" error={errors.guardianName?.message} autoComplete="name" {...register("guardianName")} />
            <Select label="Relationship" options={GUARDIAN_RELATIONSHIPS} placeholder="Select relationship" error={errors.guardianRelationship?.message} {...register("guardianRelationship")} />
            <FormField label="Contact phone" type="tel" className="sm:col-span-2" error={errors.guardianPhone?.message} autoComplete="tel" {...register("guardianPhone")} />
          </div>
        </fieldset>

        {/* Secure document upload */}
        <fieldset>
          <SecureDocumentUpload onFilesChange={setFiles} />
        </fieldset>

        {/* Attestation */}
        <Checkbox
          label="I attest that patient choice has been documented in accordance with RCW 70.41.322 lay caregiver notification requirements."
          required
          error={errors.attestation?.message}
          {...register("attestation")}
        />

        <Honeypot />

        <div className="flex flex-col gap-4">
          <FormError show={failed} />
          <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto sm:self-start" disabled={isSubmitting}>
            <Zap className="h-4 w-4" aria-hidden /> {isSubmitting ? "Dispatching…" : "Dispatch Referral to RN Clinical Queue"}
          </Button>
          <DataSecurityNotice className="border-t border-navy/10 pt-5" />
        </div>
      </form>
    </div>
  );
}

/* ---- Local field helpers ---------------------------------------------- */

type Register = ReturnType<typeof useForm<FormValues>>["register"];

/** Compact multi-select checkbox group for plain (description-less) options. */
function PlainCheckGroup({
  name,
  label,
  hint,
  options,
  error,
  register,
}: {
  name: "nursingNeeds" | "behavioralConcerns" | "assistiveDevices";
  label: string;
  hint?: string;
  options: Option[];
  error?: string;
  register: Register;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-navy">{label}</span>
        {hint && <span className="text-xs text-slate-ink/75">{hint}</span>}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy/15 bg-[#fffdf9] px-4 py-3 text-sm font-medium text-navy transition-colors hover:border-teal/50 hover:bg-teal/5 has-[:checked]:border-teal has-[:checked]:bg-teal/10 has-[:checked]:ring-1 has-[:checked]:ring-teal/40"
          >
            <input
              type="checkbox"
              value={opt.value}
              className="h-5 w-5 shrink-0 rounded-md border-navy/30 text-teal accent-teal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
              {...register(name)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

/** Multi-select checkbox group with per-option clinical descriptions. */
function CheckGroup({
  name,
  label,
  hint,
  hideLabel,
  options,
  error,
  register,
}: {
  name: "careDestinations" | "financialRouting";
  label: string;
  hint?: string;
  hideLabel?: boolean;
  options: DriverOption[];
  error?: string;
  register: Register;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {!hideLabel && (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-navy">
            {label}
            <span className="ml-0.5 text-coral">*</span>
          </span>
          {hint && <span className="text-xs text-slate-ink/75">{hint}</span>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-navy/15 bg-[#fffdf9] p-4 transition-colors hover:border-teal/50 hover:bg-teal/5 has-[:checked]:border-teal has-[:checked]:bg-teal/10 has-[:checked]:ring-1 has-[:checked]:ring-teal/40"
          >
            <input
              type="checkbox"
              value={opt.value}
              className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-navy/30 text-teal accent-teal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
              {...register(name)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy">{opt.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-ink/80">{opt.description}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

/** Single-select urgency radios rendered as selectable cards. */
function RadioCards({
  name,
  label,
  options,
  error,
  register,
}: {
  name: "urgency";
  label: string;
  options: DriverOption[];
  error?: string;
  register: Register;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-semibold text-navy">
        {label}
        <span className="ml-0.5 text-coral">*</span>
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border border-navy/15 bg-[#fffdf9] p-4 transition-colors hover:border-coral/50 hover:bg-coral/5",
              "has-[:checked]:border-coral has-[:checked]:bg-coral/10 has-[:checked]:ring-1 has-[:checked]:ring-coral/40",
            )}
          >
            <input
              type="radio"
              value={opt.value}
              className="mt-0.5 h-5 w-5 shrink-0 border-navy/30 text-coral accent-coral focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
              {...register(name)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy">{opt.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-ink/80">{opt.description}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
