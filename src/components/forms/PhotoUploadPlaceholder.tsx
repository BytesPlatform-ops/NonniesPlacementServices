import { ImagePlus } from "lucide-react";

/**
 * Non-functional photo upload UI (§16 — "Do not wire actual file upload").
 * Purely presentational; no file is read, stored, or transmitted.
 */
export function PhotoUploadPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-navy">{label}</span>
      <div
        role="button"
        tabIndex={0}
        aria-disabled="true"
        className="flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy/20 bg-ice/50 px-6 py-8 text-center"
      >
        <ImagePlus className="h-8 w-8 text-blue" aria-hidden />
        <p className="text-sm font-medium text-navy">Drag photos here or browse</p>
        <p className="text-xs text-slate-ink/70">
          Demonstration only — upload is not enabled on this frontend.
        </p>
      </div>
    </div>
  );
}
