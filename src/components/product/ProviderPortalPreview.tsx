"use client";

import { BedDouble, Camera, FileCheck2, Tag, Inbox, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpecialtyTag } from "@/components/ui/SpecialtyTag";

/** Provider capability specialties — featured (gold) specialties lead. */
const SPECIALTIES: { label: string; featured?: boolean }[] = [
  { label: "Behavioral Health", featured: true },
  { label: "Alzheimer's Care", featured: true },
  { label: "Psychiatric Support", featured: true },
  { label: "Dementia" },
  { label: "Memory Care" },
  { label: "Medication Support" },
];

/** Specialty fit shown in the provider profile summary. */
const SPECIALTY_FIT = ["Alzheimer's Care", "Behavioral Health", "Psychiatric Support"];

const INQUIRIES = [
  { name: "Case #WA-2048", meta: "Memory · Medicaid · 3-day", score: 92, tags: ["Alzheimer's", "Wandering risk", "Behavioral Health"] },
  { name: "Case #WA-2051", meta: "Assisted · Private · 2-wk", score: 86, tags: ["Dementia", "Medication support"] },
  { name: "Case #WA-2055", meta: "Skilled · Medicare · urgent", score: 79, tags: ["Psychiatric Support", "Specialized meds"] },
];

/** Provider Portal Preview — list beds, upload photos, specialties, license verified, pricing, inquiry queue. */
export function ProviderPortalPreview({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-card", className)}>
      <div className="flex items-center justify-between border-b border-navy/10 bg-ice/60 px-5 py-3.5">
        <p className="text-sm font-semibold text-navy">Cedar Grove AFH · Provider portal</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1 text-[0.7rem] font-semibold text-teal">
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden /> License verified
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {/* Beds + pricing */}
        <div className="rounded-2xl border border-navy/10 bg-ice/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy">
            <BedDouble className="h-4 w-4 text-blue" aria-hidden /> Beds available
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Single", v: "2" },
              { k: "Shared", v: "1" },
              { k: "Total", v: "3" },
            ].map((b) => (
              <div key={b.k} className="rounded-xl bg-white p-2 shadow-soft">
                <p className="font-display text-xl font-semibold text-navy">{b.v}</p>
                <p className="text-[0.65rem] text-slate-ink">{b.k}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-ink">
            <Tag className="h-3.5 w-3.5 text-teal" aria-hidden /> $4,000–$6,500 / mo · Private · Medicaid
          </div>
        </div>

        {/* Specialties + specialty fit */}
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-sm font-semibold text-navy">Specialties</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPECIALTIES.map((s) => (
              <SpecialtyTag key={s.label} label={s.label} variant={s.featured ? "gold" : "default"} className="px-2.5 py-1 text-[0.68rem]" />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#a9741f]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Specialty fit
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPECIALTY_FIT.map((s) => (
              <SpecialtyTag key={s} label={s} variant="gold" className="px-2.5 py-1 text-[0.68rem]" />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-navy">
            <Camera className="h-4 w-4 text-blue" aria-hidden /> Photos
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {["from-teal/30 to-blue/20", "from-blue/25 to-navy/20", "from-coral/20 to-teal/20", "from-navy/20 to-blue/15"].map((g, i) => (
              <div key={i} className={cn("aspect-square rounded-lg bg-gradient-to-br", g)} />
            ))}
          </div>
        </div>

        {/* Inquiry queue */}
        <div className="rounded-2xl border border-navy/10 bg-white p-4 sm:col-span-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Inbox className="h-4 w-4 text-blue" aria-hidden /> Inquiry queue
            <span className="ml-auto rounded-full bg-coral/10 px-2 py-0.5 text-[0.65rem] font-bold text-coral">3 new · RN-matched</span>
          </p>
          <div className="mt-3 space-y-2">
            {INQUIRIES.map((q) => (
              <div key={q.name} className="flex items-center gap-3 rounded-xl border border-navy/10 bg-ice/40 px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 font-display text-xs font-bold text-teal">{q.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{q.name}</p>
                  <p className="truncate text-xs text-slate-ink">{q.meta}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {q.tags.map((t) => (
                      <SpecialtyTag key={t} label={t} variant="default" className="px-2 py-0.5 text-[0.62rem]" />
                    ))}
                  </div>
                </div>
                <span className="hidden shrink-0 rounded-lg bg-navy px-2.5 py-1 text-[0.68rem] font-semibold text-white sm:inline">Review</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
