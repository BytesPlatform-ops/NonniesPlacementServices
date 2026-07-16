"use client";

import { useState, type BaseSyntheticEvent } from "react";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Users, UserRound, ListChecks, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FormSuccess } from "./FormSuccess";
import { FormError } from "./FormError";
import { Honeypot } from "./Honeypot";
import { DataSecurityNotice } from "./DataSecurityNotice";
import { submitForm, field, optionLabel, readHoneypot } from "@/lib/forms/submitForm";
import type { Option } from "@/data/careTypes";

const LIVING_SITUATION: Option[] = [
  { value: "living-independently", label: "Living independently" },
  { value: "living-with-family", label: "Living with family" },
  { value: "hospital", label: "Hospital" },
  { value: "skilled-nursing-facility", label: "Skilled Nursing Facility" },
  { value: "rehabilitation-facility", label: "Rehabilitation Facility" },
  { value: "other", label: "Other" },
];

const TIMELINE: Option[] = [
  { value: "immediately", label: "Immediately" },
  { value: "24-48-hours", label: "Within 24–48 hours" },
  { value: "one-week", label: "Within one week" },
  { value: "one-month", label: "Within one month" },
  { value: "gathering-information", label: "Just gathering information" },
];

const SERVICES_NEEDED = [
  "Personal Care",
  "Bathing Assistance",
  "Dressing Assistance",
  "Meal Preparation",
  "Medication Reminders",
  "Transportation",
  "Companionship",
  "Dementia Care",
  "Overnight Care",
  "24-Hour Care",
  "Respite Care",
  "Other",
];

const SCHEDULE = [
  "Morning",
  "Afternoon",
  "Evening",
  "Overnight",
  "Weekdays",
  "Weekends",
  "Live-In Care",
  "24-Hour Care",
];

const schema = z
  .object({
    contactName: z.string().min(2, "Enter the primary contact name"),
    relationship: z.string().min(2, "Enter your relationship to the client"),
    phone: z.string().min(7, "Enter a valid phone number"),
    email: z.string().email("Enter a valid email address"),
    clientName: z.string().min(2, "Enter the client's name"),
    age: z.string().max(3, "Enter a valid age").optional().or(z.literal("")),
    city: z.string().max(80).optional().or(z.literal("")),
    livingSituation: z.string().min(1, "Select a current living situation"),
    servicesNeeded: z.array(z.string()),
    servicesNeededOther: z.string().optional(),
    timeline: z.string().min(1, "Select how soon services are needed"),
    schedule: z.array(z.string()),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  // When "Other" is checked under Services Needed, its free-text field is required.
  .superRefine((data, ctx) => {
    if (data.servicesNeeded.includes("Other")) {
      const v = data.servicesNeededOther;
      if (typeof v !== "string" || v.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please describe the service needed", path: ["servicesNeededOther"] });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

type Register = UseFormRegister<FormValues>;

function CheckboxGroup({
  legend,
  icon: Icon,
  name,
  options,
  register,
  other,
}: {
  legend: string;
  icon: typeof ListChecks;
  name: "servicesNeeded" | "schedule";
  options: string[];
  register: Register;
  /** Conditional free-text field rendered below the options (e.g. for "Other"). */
  other?: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="flex items-center gap-2 text-sm font-semibold text-navy">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal/12 text-teal">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {legend}
      </legend>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy/15 bg-[#fffdf9] px-3.5 py-2.5 text-sm font-medium text-navy transition-colors hover:border-teal/50 hover:bg-teal/5 has-[:checked]:border-teal has-[:checked]:bg-teal/10 has-[:checked]:ring-1 has-[:checked]:ring-teal/40"
          >
            <input
              type="checkbox"
              value={opt}
              className="h-5 w-5 shrink-0 rounded-md border-navy/30 text-teal accent-teal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
              {...register(name)}
            />
            {opt}
          </label>
        ))}
      </div>
      {other}
    </fieldset>
  );
}

function SectionLabel({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-navy/10 pb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal/12 text-teal">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
    </div>
  );
}

export function HomeCareInquiryForm() {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { servicesNeeded: [], schedule: [] },
  });

  const servicesNeeded = useWatch({ control, name: "servicesNeeded" });
  const showServicesOther = Array.isArray(servicesNeeded) && servicesNeeded.includes("Other");

  const onSubmit = async (data: FormValues, event?: BaseSyntheticEvent) => {
    setFailed(false);
    try {
      await submitForm({
        formName: "Cascadia Home Health",
        replyTo: data.email,
        honeypot: readHoneypot(event),
        raw: data,
        sections: [
          {
            title: "Family Information",
            fields: [
              field("Primary Contact Name", data.contactName),
              field("Relationship to Client", data.relationship),
              field("Phone Number", data.phone),
              field("Email Address", data.email),
            ],
          },
          {
            title: "Client Information",
            fields: [
              field("Client Name", data.clientName),
              field("Age", data.age),
              field("City", data.city),
              { label: "Current Living Situation", value: optionLabel(LIVING_SITUATION, data.livingSituation) },
            ],
          },
          {
            title: "Services",
            fields: [
              field("Services Needed", data.servicesNeeded),
              field("Other service details", data.servicesNeededOther),
              { label: "How Soon Do You Need Services?", value: optionLabel(TIMELINE, data.timeline) },
              field("Preferred Schedule", data.schedule),
            ],
          },
          {
            title: "Additional Information",
            fields: [field("Additional Information", data.notes)],
          },
        ],
      });
      setDone(true);
    } catch {
      setFailed(true);
    }
  };

  if (done) {
    return (
      <FormSuccess
        title="Inquiry received"
        message="A member of our care coordination team will contact you as soon as possible to discuss your needs."
        onReset={() => {
          reset();
          setDone(false);
        }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-card">
      <div className="flex items-center gap-2.5 border-b border-navy/10 bg-gradient-to-r from-ice to-white px-6 py-4 sm:px-8">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 text-teal">
          <Send className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy">Request Home Care Services</p>
          <p className="text-xs text-slate-ink/70">RN-led care coordination · Washington State</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-9 p-6 sm:p-8" noValidate>
        {/* Family Information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={Users} title="Family Information" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Primary Contact Name" required error={errors.contactName?.message} autoComplete="name" {...register("contactName")} />
            <FormField label="Relationship to Client" required error={errors.relationship?.message} {...register("relationship")} />
            <FormField label="Phone Number" type="tel" required error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
            <FormField label="Email Address" type="email" required error={errors.email?.message} autoComplete="email" {...register("email")} />
          </div>
        </fieldset>

        {/* Client Information */}
        <fieldset className="flex flex-col gap-5">
          <SectionLabel icon={UserRound} title="Client Information" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Client Name" required error={errors.clientName?.message} {...register("clientName")} />
            <FormField label="Age" inputMode="numeric" maxLength={3} error={errors.age?.message} {...register("age")} />
            <FormField label="City" error={errors.city?.message} autoComplete="address-level2" {...register("city")} />
            <Select label="Current Living Situation" required options={LIVING_SITUATION} placeholder="Select a living situation" error={errors.livingSituation?.message} {...register("livingSituation")} />
          </div>
        </fieldset>

        {/* Services Needed */}
        <CheckboxGroup
          legend="Services Needed"
          icon={ListChecks}
          name="servicesNeeded"
          options={SERVICES_NEEDED}
          register={register}
          other={
            showServicesOther && (
              <div className="mt-4">
                <label htmlFor="servicesNeededOther" className="text-sm font-semibold text-navy">
                  Please describe the service needed
                </label>
                <input
                  id="servicesNeededOther"
                  type="text"
                  placeholder="Tell us what other support is needed"
                  aria-invalid={!!errors.servicesNeededOther}
                  className="mt-1.5 w-full rounded-xl border border-navy/20 bg-[#fffdf9] px-4 py-3 text-sm text-navy placeholder:text-slate-ink/55 transition-[border-color,box-shadow] duration-150 focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/20"
                  {...register("servicesNeededOther")}
                />
                {errors.servicesNeededOther?.message && (
                  <p role="alert" className="mt-2 text-sm font-medium text-coral">
                    {errors.servicesNeededOther.message}
                  </p>
                )}
              </div>
            )
          }
        />

        {/* How soon */}
        <div className="max-w-md">
          <Select label="How Soon Do You Need Services?" required options={TIMELINE} placeholder="Select a timeframe" error={errors.timeline?.message} {...register("timeline")} />
        </div>

        {/* Preferred Schedule */}
        <CheckboxGroup legend="Preferred Schedule" icon={CalendarClock} name="schedule" options={SCHEDULE} register={register} />

        {/* Additional Information */}
        <Textarea
          label="Additional Information"
          placeholder="Please tell us about your loved one's care needs, medical conditions, mobility, or any other information that will help us better understand how we can assist."
          rows={5}
          error={errors.notes?.message}
          {...register("notes")}
        />

        <Honeypot />

        <div className="flex flex-col gap-4">
          <FormError show={failed} />
          <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto sm:self-start" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Inquiry"} <Send className="h-4 w-4" aria-hidden />
          </Button>
          <p className="text-sm leading-relaxed text-slate-ink">
            A member of our care coordination team will contact you as soon as possible to discuss your needs.
          </p>
          <DataSecurityNotice className="border-t border-navy/10 pt-5" />
        </div>
      </form>
    </div>
  );
}
