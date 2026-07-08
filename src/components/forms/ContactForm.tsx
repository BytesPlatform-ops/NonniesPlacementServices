"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSuccess } from "./FormSuccess";

const INQUIRY_TYPES = [
  { value: "family", label: "I'm a family / care seeker" },
  { value: "hospital", label: "I'm a hospital / discharge planner" },
  { value: "provider", label: "I'm a care provider" },
  { value: "general", label: "General question" },
];

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(40).optional().or(z.literal("")),
  inquiryType: z.string().min(1, "Select an option"),
  message: z.string().min(10, "Tell us a little more (10+ characters)"),
  consent: z.literal(true, { message: "Please provide consent to continue" }),
});

type FormValues = z.infer<typeof schema>;

export function ContactForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const onSubmit = async () => {
    await new Promise((r) => setTimeout(r, 600));
    setDone(true);
  };

  if (done) {
    return (
      <FormSuccess
        title="Message sent"
        message="Thanks for reaching out — a member of our team would normally reply within one business day."
        onReset={() => {
          reset();
          setDone(false);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-3xl border border-navy/10 bg-white p-6 shadow-card sm:p-8"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Your name" required error={errors.name?.message} autoComplete="name" {...register("name")} />
        <FormField label="Email" type="email" required error={errors.email?.message} autoComplete="email" {...register("email")} />
        <FormField label="Phone" type="tel" hint="Optional" error={errors.phone?.message} autoComplete="tel" {...register("phone")} />
        <Select label="I'm reaching out as" required options={INQUIRY_TYPES} error={errors.inquiryType?.message} {...register("inquiryType")} />
        <Textarea
          label="How can we help?"
          className="sm:col-span-2"
          placeholder="Share as much or as little as you like…"
          error={errors.message?.message}
          {...register("message")}
        />
        <Checkbox
          className="sm:col-span-2"
          label="I consent to being contacted about my inquiry and understand this is a demonstration form."
          required
          error={errors.consent?.message}
          {...register("consent")}
        />
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-8 w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send message"} <Send className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
