"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-lg border border-sage bg-ivory shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-sage px-5 py-3">
          <h2 className="text-sm font-semibold text-umber">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  neutral: "text-umber",
  warning: "text-amber-700",
  negative: "text-rose-700",
  positive: "text-emerald-700",
};

export function MetricCard({
  label,
  value,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "negative" | "positive";
  href?: string;
}) {
  const body = (
    <div className={cn("rounded-lg border border-sage bg-ivory p-4 shadow-card transition-colors", href && "hover:border-brand-300")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", TONE_CLASSES[tone])}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
