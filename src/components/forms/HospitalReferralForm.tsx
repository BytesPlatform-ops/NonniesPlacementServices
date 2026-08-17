"use client";

import { useState, type BaseSyntheticEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  Stethoscope,
  UserRound,
  ClipboardList,
  Layers,
  Activity,
  HeartPulse,
  ShieldAlert,
  Wallet,
  Users,
  MapPin,
  FileText,
  Info,
} from "lucide-react";
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
  URGENCY_LEVELS,
  PATIENT_GENDERS,
  LEVELS_OF_CARE,
  CLINICAL_CONDITIONS,
  ADL_AREAS,
  ADL_ASSIST_LEVELS,
  MOBILITY_EQUIPMENT,
  NURSE_DELEGATION_OPTIONS,
  NURSING_NEEDS,
  BEHAVIORAL_CONCERNS,
  SUPERVISION_LEVELS,
  FUNDING_OPTIONS,
  PRIVATE_PAY_BUDGETS,
  YES_NO_UNSURE,
  AWARENESS_OPTIONS,
  ROOM_PREFERENCES,
  PLACEMENT_FEATURES,
  SMOKING_STATUS,
  GENDER_PREFERENCE,
  DOCUMENT_TYPES,
} from "@/data/hospitalReferral";

const schema = z
  .object({
    // 1. Referring Professional
    refName: z.string().min(2, "Enter your name"),
    refTitle: z.string().min(1, "Enter your title / role"),
    hospital: z.string().min(1, "Enter the hospital / facility"),
    unitFloor: z.string().optional(),
    phone: z.string().min(7, "Enter a direct phone"),
    email: z.string().email("Enter a valid secure email"),
    targetDischargeDate: z.string().min(1, "Select a target discharge date"),
    urgency: z.string().min(1, "Select an urgency window"),

    // 2. Patient Information
    patientName: z.string().min(1, "Enter patient name / initials"),
    ageDob: z.string().optional(),
    gender: z.string().optional(),
    currentLocation: z.string().optional(),
    preferredArea: z.string().optional(),
    language: z.string().optional(),

    // 3. Level of Care Needed
    levelOfCare: z.array(z.string()).min(1, "Select at least one level of care"),
    levelOfCareOther: z.string().optional(),

    // 4. Diagnosis / Clinical Information
    primaryDiagnosis: z.string().min(2, "Enter the primary diagnosis"),
    secondaryDiagnoses: z.string().max(1500).optional(),
    reasonForHospitalization: z.string().max(1500).optional(),
    clinicalConditions: z.array(z.string()),
    otherMedicalConditions: z.string().max(1500).optional(),

    // 5. Mobility & ADLs
    adlAmbulation: z.string().optional(),
    adlTransfers: z.string().optional(),
    adlBathing: z.string().optional(),
    adlDressing: z.string().optional(),
    adlToileting: z.string().optional(),
    adlGrooming: z.string().optional(),
    adlEating: z.string().optional(),
    mobilityEquipment: z.array(z.string()),

    // 6. Nursing / Medical Needs
    nurseDelegation: z.string().min(1, "Select an option"),
    nursingNeeds: z.array(z.string()),
    nursingNeedsOther: z.string().max(300).optional(),

    // 7. Behavioral / Safety Needs
    behavioralConcerns: z.array(z.string()),
    behavioralConcernsOther: z.string().max(300).optional(),
    supervisionLevel: z.string().optional(),
    behavioralComments: z.string().max(1500).optional(),

    // 8. Funding
    funding: z.array(z.string()).min(1, "Select at least one funding source"),
    fundingOther: z.string().optional(),
    privatePayBudget: z.string().optional(),

    // 9. Decision-Making / Contacts
    patientDecisions: z.string().optional(),
    guardianRep: z.string().optional(),
    familyContact: z.string().optional(),
    contactPhoneEmail: z.string().optional(),
    patientAware: z.string().optional(),

    // 10. Placement Preferences
    roomPreference: z.string().optional(),
    preferredCitiesZips: z.string().optional(),
    placementFeatures: z.array(z.string()),
    smokingStatus: z.string().optional(),
    languageCultural: z.string().optional(),
    genderPreference: z.string().optional(),
    otherPlacementConsiderations: z.string().max(1500).optional(),

    // 11. Documents
    documentsIncluded: z.array(z.string()),

    // 12. Additional Information
    primaryBarrier: z.string().max(1000).optional(),
    additionalProviderInfo: z.string().max(1500).optional(),
    additionalComments: z.string().max(1500).optional(),

    attestation: z.literal(true, { message: "Please confirm patient choice has been documented" }),
  })
  .superRefine((data, ctx) => {
    if (data.levelOfCare.includes("other") && !data.levelOfCareOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["levelOfCareOther"], message: "Please describe the other care type." });
    }
    const nursingOn = data.nurseDelegation === "yes" || data.nurseDelegation === "unsure";
    if (nursingOn && data.nursingNeeds.includes("other") && !data.nursingNeedsOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["nursingNeedsOther"], message: "Please describe the nursing need." });
    }
    if (data.behavioralConcerns.includes("other") && !data.behavioralConcernsOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["behavioralConcernsOther"], message: "Please describe the behavior." });
    }
    if (data.funding.includes("other") && !data.fundingOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["fundingOther"], message: "Please describe the funding source." });
    }
    if (data.funding.includes("private-pay") && !data.privatePayBudget) {
      ctx.addIssue({ code: "custom", path: ["privatePayBudget"], message: "Select an approximate monthly budget." });
    }
  });

type FormValues = z.infer<typeof schema>;
type Register = ReturnType<typeof useForm<FormValues>>["register"];
type FieldName = Parameters<Register>[0];

/** Section header inside the single-screen form. */
function SectionLabel({ icon: Icon, step, title, children }: { icon: typeof Stethoscope; step: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-navy/10 pb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal/12 text-teal">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-navy">
          <span className="text-slate-ink/50">{step}.</span> {title}
        </h3>
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
      levelOfCare: [],
      clinicalConditions: [],
      mobilityEquipment: [],
      nursingNeeds: [],
      behavioralConcerns: [],
      funding: [],
      placementFeatures: [],
      documentsIncluded: [],
    },
  });

  // Conditional reveals keep the long form manageable.
  const levelOfCare = useWatch({ control, name: "levelOfCare" });
  const showLevelOther = levelOfCare?.includes("other") ?? false;
  const nurseDelegation = useWatch({ control, name: "nurseDelegation" });
  const showNursing = nurseDelegation === "yes" || nurseDelegation === "unsure";
  const nursingNeeds = useWatch({ control, name: "nursingNeeds" });
  const showNursingOther = nursingNeeds?.includes("other") ?? false;
  const behavioralConcerns = useWatch({ control, name: "behavioralConcerns" });
  const showBehavioralOther = behavioralConcerns?.includes("other") ?? false;
  const funding = useWatch({ control, name: "funding" });
  const showFundingOther = funding?.includes("other") ?? false;
  const showPrivateBudget = funding?.includes("private-pay") ?? false;

  const onSubmit = async (data: FormValues, event?: BaseSyntheticEvent) => {
    setFailed(false);

    const adlFields: SubmissionFieldItem[] = [
      { label: "ADL — Ambulation", value: optionLabel(ADL_ASSIST_LEVELS, data.adlAmbulation) },
      { label: "ADL — Transfers", value: optionLabel(ADL_ASSIST_LEVELS, data.adlTransfers) },
      { label: "ADL — Bathing", value: optionLabel(ADL_ASSIST_LEVELS, data.adlBathing) },
      { label: "ADL — Dressing", value: optionLabel(ADL_ASSIST_LEVELS, data.adlDressing) },
      { label: "ADL — Toileting", value: optionLabel(ADL_ASSIST_LEVELS, data.adlToileting) },
      { label: "ADL — Grooming", value: optionLabel(ADL_ASSIST_LEVELS, data.adlGrooming) },
      { label: "ADL — Eating / feeding", value: optionLabel(ADL_ASSIST_LEVELS, data.adlEating) },
      field("Mobility equipment / status", optionLabels(MOBILITY_EQUIPMENT, data.mobilityEquipment)),
    ];

    const nursingFields: SubmissionFieldItem[] = [
      { label: "Nurse delegation needed", value: optionLabel(NURSE_DELEGATION_OPTIONS, data.nurseDelegation) },
      ...(showNursing ? [field("Nursing / medical needs", optionLabels(NURSING_NEEDS, data.nursingNeeds))] : []),
      ...(showNursing && data.nursingNeeds.includes("other") ? [field("Other nursing need", data.nursingNeedsOther)] : []),
    ];

    const fundingFields: SubmissionFieldItem[] = [
      field("Funding source(s)", optionLabels(FUNDING_OPTIONS, data.funding)),
      ...(data.funding.includes("other") ? [field("Other funding", data.fundingOther)] : []),
      ...(data.funding.includes("private-pay")
        ? [{ label: "Approx. monthly budget", value: optionLabel(PRIVATE_PAY_BUDGETS, data.privatePayBudget) }]
        : []),
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
            title: "Referring Professional",
            fields: [
              field("Name", data.refName),
              field("Title / role", data.refTitle),
              field("Hospital / facility", data.hospital),
              field("Unit / floor", data.unitFloor),
              field("Direct phone", data.phone),
              field("Secure email", data.email),
              field("Target discharge date", data.targetDischargeDate),
              { label: "Urgency", value: optionLabel(URGENCY_LEVELS, data.urgency) },
            ],
          },
          {
            title: "Patient Information",
            fields: [
              field("Patient name / initials", data.patientName),
              field("Age / DOB", data.ageDob),
              { label: "Gender", value: optionLabel(PATIENT_GENDERS, data.gender) },
              field("Current location", data.currentLocation),
              field("Preferred placement city / area", data.preferredArea),
              field("Preferred language / interpreter", data.language),
            ],
          },
          {
            title: "Level of Care Needed",
            fields: [
              field("Level of care", optionLabels(LEVELS_OF_CARE, data.levelOfCare)),
              ...(data.levelOfCare.includes("other") ? [field("Other level of care", data.levelOfCareOther)] : []),
            ],
          },
          {
            title: "Diagnosis / Clinical Information",
            fields: [
              field("Primary diagnosis", data.primaryDiagnosis),
              field("Secondary diagnoses / conditions", data.secondaryDiagnoses),
              field("Reason for hospitalization", data.reasonForHospitalization),
              field("Clinical conditions", optionLabels(CLINICAL_CONDITIONS, data.clinicalConditions)),
              field("Other significant medical conditions", data.otherMedicalConditions),
            ],
          },
          { title: "Mobility & ADLs", fields: adlFields },
          { title: "Nursing / Medical Needs", fields: nursingFields },
          {
            title: "Behavioral / Safety Needs",
            fields: [
              field("Behavioral / safety concerns", optionLabels(BEHAVIORAL_CONCERNS, data.behavioralConcerns)),
              ...(data.behavioralConcerns.includes("other") ? [field("Other behavior", data.behavioralConcernsOther)] : []),
              { label: "Current supervision", value: optionLabel(SUPERVISION_LEVELS, data.supervisionLevel) },
              field("Behavioral history / recent incidents", data.behavioralComments),
            ],
          },
          { title: "Funding", fields: fundingFields },
          {
            title: "Decision-Making / Contacts",
            fields: [
              { label: "Patient makes own decisions", value: optionLabel(YES_NO_UNSURE, data.patientDecisions) },
              field("Guardian / DPOA / legal representative", data.guardianRep),
              field("Family / contact person", data.familyContact),
              field("Contact phone / email", data.contactPhoneEmail),
              { label: "Patient / family aware of referral", value: optionLabel(AWARENESS_OPTIONS, data.patientAware) },
            ],
          },
          {
            title: "Placement Preferences",
            fields: [
              { label: "Room preference", value: optionLabel(ROOM_PREFERENCES, data.roomPreference) },
              field("Preferred cities / ZIP codes", data.preferredCitiesZips),
              field("Placement features", optionLabels(PLACEMENT_FEATURES, data.placementFeatures)),
              { label: "Smoking status", value: optionLabel(SMOKING_STATUS, data.smokingStatus) },
              field("Language / cultural preferences", data.languageCultural),
              { label: "Gender preference", value: optionLabel(GENDER_PREFERENCE, data.genderPreference) },
              field("Other placement considerations", data.otherPlacementConsiderations),
            ],
          },
          {
            title: "Documents",
            fields: [field("Documents included", optionLabels(DOCUMENT_TYPES, data.documentsIncluded))],
          },
          {
            title: "Additional Information",
            fields: [
              field("Primary barrier to discharge", data.primaryBarrier),
              field("Info a prospective provider should know", data.additionalProviderInfo),
              field("Additional comments", data.additionalComments),
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
        {/* 1. Referring Professional */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={UserRound} step={1} title="Referring Professional" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Name" required error={errors.refName?.message} autoComplete="name" {...register("refName")} />
            <FormField label="Title / role" required error={errors.refTitle?.message} {...register("refTitle")} />
            <FormField label="Hospital / facility" required error={errors.hospital?.message} autoComplete="organization" {...register("hospital")} />
            <FormField label="Unit / floor" error={errors.unitFloor?.message} {...register("unitFloor")} />
            <FormField label="Direct phone" type="tel" required error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
            <FormField label="Secure email" type="email" required error={errors.email?.message} autoComplete="email" {...register("email")} />
            <FormField label="Target discharge date" type="date" required error={errors.targetDischargeDate?.message} {...register("targetDischargeDate")} />
            <RadioRow
              className="sm:col-span-2"
              name="urgency"
              label="Urgency"
              required
              options={URGENCY_LEVELS}
              error={errors.urgency?.message}
              register={register}
            />
          </div>
        </fieldset>

        {/* 2. Patient Information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={ClipboardList} step={2} title="Patient Information" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Patient name / initials" required error={errors.patientName?.message} {...register("patientName")} />
            <FormField label="Age / DOB" error={errors.ageDob?.message} placeholder="e.g. 82 or 03/14/1943" {...register("ageDob")} />
            <Select label="Gender" options={PATIENT_GENDERS} placeholder="Select gender" error={errors.gender?.message} {...register("gender")} />
            <FormField label="Current location" error={errors.currentLocation?.message} placeholder="Unit / room, or facility" {...register("currentLocation")} />
            <FormField label="Preferred placement city / area" error={errors.preferredArea?.message} {...register("preferredArea")} />
            <FormField label="Preferred language / interpreter" error={errors.language?.message} placeholder="e.g. Spanish — interpreter needed" {...register("language")} />
          </div>
        </fieldset>

        {/* 3. Level of Care Needed */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Layers} step={3} title="Level of Care Needed" />
          <PlainCheckGroup name="levelOfCare" label="Select all that apply" required options={LEVELS_OF_CARE} error={errors.levelOfCare?.message} register={register} />
          {showLevelOther && (
            <FormField label="Other level of care" placeholder="Please describe" error={errors.levelOfCareOther?.message} {...register("levelOfCareOther")} />
          )}
        </fieldset>

        {/* 4. Diagnosis / Clinical Information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Activity} step={4} title="Diagnosis / Clinical Information" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Primary diagnosis" required className="sm:col-span-2" error={errors.primaryDiagnosis?.message} {...register("primaryDiagnosis")} />
            <Textarea label="Secondary diagnoses / medical conditions" className="sm:col-span-2" rows={2} error={errors.secondaryDiagnoses?.message} {...register("secondaryDiagnoses")} />
            <Textarea label="Reason for hospitalization" className="sm:col-span-2" rows={2} error={errors.reasonForHospitalization?.message} {...register("reasonForHospitalization")} />
          </div>
          <PlainCheckGroup name="clinicalConditions" label="Clinical conditions (select all that apply)" options={CLINICAL_CONDITIONS} error={errors.clinicalConditions?.message} register={register} />
          <Textarea label="Other significant medical conditions" rows={2} error={errors.otherMedicalConditions?.message} {...register("otherMedicalConditions")} />
        </fieldset>

        {/* 5. Mobility & ADLs */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={HeartPulse} step={5} title="Mobility & ADLs" />
          <AdlMatrix areas={ADL_AREAS} levels={ADL_ASSIST_LEVELS} register={register} />
          <PlainCheckGroup name="mobilityEquipment" label="Equipment & mobility status (select all that apply)" options={MOBILITY_EQUIPMENT} error={errors.mobilityEquipment?.message} register={register} />
        </fieldset>

        {/* 6. Nursing / Medical Needs */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Stethoscope} step={6} title="Nursing / Medical Needs" />
          <RadioRow name="nurseDelegation" label="Nurse delegation needed?" required options={NURSE_DELEGATION_OPTIONS} error={errors.nurseDelegation?.message} register={register} />
          {showNursing && (
            <>
              <PlainCheckGroup name="nursingNeeds" label="Nursing / medical care needs (select all that apply)" options={NURSING_NEEDS} error={errors.nursingNeeds?.message} register={register} />
              {showNursingOther && (
                <FormField label="Other nursing need" placeholder="Please describe" error={errors.nursingNeedsOther?.message} {...register("nursingNeedsOther")} />
              )}
            </>
          )}
        </fieldset>

        {/* 7. Behavioral / Safety Needs */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={ShieldAlert} step={7} title="Behavioral / Safety Needs" />
          <PlainCheckGroup name="behavioralConcerns" label="Select all that apply" options={BEHAVIORAL_CONCERNS} error={errors.behavioralConcerns?.message} register={register} />
          {showBehavioralOther && (
            <FormField label="Other behavior" placeholder="Please describe" error={errors.behavioralConcernsOther?.message} {...register("behavioralConcernsOther")} />
          )}
          <RadioRow name="supervisionLevel" label="Current supervision" options={SUPERVISION_LEVELS} error={errors.supervisionLevel?.message} register={register} />
          <Textarea label="Behavioral history / recent incidents" rows={2} placeholder="Triggers, frequency, recent incidents, what de-escalates…" error={errors.behavioralComments?.message} {...register("behavioralComments")} />
        </fieldset>

        {/* 8. Funding */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Wallet} step={8} title="Funding" />
          <PlainCheckGroup name="funding" label="Select all that apply" required options={FUNDING_OPTIONS} error={errors.funding?.message} register={register} />
          {showFundingOther && (
            <FormField label="Other funding" placeholder="Please describe" error={errors.fundingOther?.message} {...register("fundingOther")} />
          )}
          {showPrivateBudget && (
            <Select label="Approximate monthly budget" required options={PRIVATE_PAY_BUDGETS} error={errors.privatePayBudget?.message} {...register("privatePayBudget")} />
          )}
        </fieldset>

        {/* 9. Decision-Making / Contacts */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Users} step={9} title="Decision-Making / Contacts" />
          <RadioRow name="patientDecisions" label="Patient makes own decisions" options={YES_NO_UNSURE} error={errors.patientDecisions?.message} register={register} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Guardian / DPOA / legal representative" error={errors.guardianRep?.message} {...register("guardianRep")} />
            <FormField label="Family / contact person" error={errors.familyContact?.message} {...register("familyContact")} />
            <FormField label="Contact phone / email" className="sm:col-span-2" error={errors.contactPhoneEmail?.message} {...register("contactPhoneEmail")} />
          </div>
          <RadioRow name="patientAware" label="Patient / family aware of referral" options={AWARENESS_OPTIONS} error={errors.patientAware?.message} register={register} />
        </fieldset>

        {/* 10. Placement Preferences */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={MapPin} step={10} title="Placement Preferences" />
          <RadioRow name="roomPreference" label="Room preference" options={ROOM_PREFERENCES} error={errors.roomPreference?.message} register={register} />
          <PlainCheckGroup name="placementFeatures" label="Required features (select all that apply)" options={PLACEMENT_FEATURES} error={errors.placementFeatures?.message} register={register} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Preferred cities / ZIP codes" error={errors.preferredCitiesZips?.message} {...register("preferredCitiesZips")} />
            <Select label="Smoking status" options={SMOKING_STATUS} placeholder="Select status" error={errors.smokingStatus?.message} {...register("smokingStatus")} />
            <FormField label="Language / cultural preferences" error={errors.languageCultural?.message} {...register("languageCultural")} />
            <Select label="Gender preference (if applicable)" options={GENDER_PREFERENCE} placeholder="Select preference" error={errors.genderPreference?.message} {...register("genderPreference")} />
          </div>
          <Textarea label="Other important placement considerations" rows={2} error={errors.otherPlacementConsiderations?.message} {...register("otherPlacementConsiderations")} />
        </fieldset>

        {/* 11. Document Upload */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={FileText} step={11} title="Document Upload">
            Tag what you&apos;re attaching, then upload the files below.
          </SectionLabel>
          <PlainCheckGroup name="documentsIncluded" label="Documents included (select all that apply)" options={DOCUMENT_TYPES} error={errors.documentsIncluded?.message} register={register} />
          <SecureDocumentUpload onFilesChange={setFiles} />
        </fieldset>

        {/* 12. Additional Information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Info} step={12} title="Additional Information" />
          <FormField label="Primary barrier to discharge" error={errors.primaryBarrier?.message} {...register("primaryBarrier")} />
          <Textarea label="Additional information a prospective provider should know" rows={2} error={errors.additionalProviderInfo?.message} {...register("additionalProviderInfo")} />
          <Textarea label="Additional comments" rows={2} error={errors.additionalComments?.message} {...register("additionalComments")} />
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

/** Compact multi-select checkbox group for plain (description-less) options. */
function PlainCheckGroup({
  name,
  label,
  hint,
  required,
  options,
  error,
  register,
}: {
  name: FieldName;
  label: string;
  hint?: string;
  required?: boolean;
  options: Option[];
  error?: string;
  register: Register;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-navy">
          {label}
          {required && <span className="ml-0.5 text-coral">*</span>}
        </span>
        {hint && <span className="text-xs text-slate-ink/75">{hint}</span>}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy/15 bg-[#fffdf9] px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:border-teal/50 hover:bg-teal/5 has-[:checked]:border-teal has-[:checked]:bg-teal/10 has-[:checked]:ring-1 has-[:checked]:ring-teal/40"
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

/** Inline single-select rendered as selectable pills. */
function RadioRow({
  name,
  label,
  options,
  error,
  required,
  className,
  register,
}: {
  name: FieldName;
  label: string;
  options: Option[];
  error?: string;
  required?: boolean;
  className?: string;
  register: Register;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span className="text-sm font-semibold text-navy">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="cursor-pointer rounded-full border border-navy/20 bg-[#fffdf9] px-4 py-2 text-sm font-medium text-navy transition-colors hover:border-teal/50 has-[:checked]:border-teal has-[:checked]:bg-teal/10 has-[:checked]:text-teal has-[:checked]:ring-1 has-[:checked]:ring-teal/40 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral"
          >
            <input type="radio" value={opt.value} className="sr-only" {...register(name)} />
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

/** Matrix of ADL areas × assistance levels (one radio choice per area). */
function AdlMatrix({ areas, levels, register }: { areas: Option[]; levels: Option[]; register: Register }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-navy">Mobility & ADL assistance level</span>
        <span className="text-xs text-slate-ink/75">Set the assistance level for each area.</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-navy/15">
        <table className="w-full min-w-[440px] border-collapse text-sm">
          <thead>
            <tr className="bg-navy/[0.03]">
              <th className="p-2.5 text-left text-xs font-semibold text-slate-ink/70" scope="col">
                Area
              </th>
              {levels.map((l) => (
                <th key={l.value} className="p-2.5 text-center text-xs font-semibold text-slate-ink/70" scope="col">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.value} className="border-t border-navy/10">
                <td className="p-2.5 font-medium text-navy">{a.label}</td>
                {levels.map((l) => (
                  <td key={l.value} className="p-2.5 text-center">
                    <input
                      type="radio"
                      value={l.value}
                      aria-label={`${a.label}: ${l.label}`}
                      className="h-4 w-4 accent-teal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
                      {...register(a.value as FieldName)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
