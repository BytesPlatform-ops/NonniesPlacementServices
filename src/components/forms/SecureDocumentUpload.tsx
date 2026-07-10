"use client";

import { useState } from "react";
import { Lock, UploadCloud, FileText, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECOMMENDED_UPLOADS } from "@/data/hospitalReferral";

/**
 * Secure clinical document staging target. Presentational only — no file is
 * read, stored, or transmitted (frontend-only build). It surfaces file names
 * locally so the interaction feels real, then clears them, but nothing leaves
 * the browser. The AES-256 / HIPAA framing describes the intended secure
 * pipeline, not a live upload.
 */
export function SecureDocumentUpload({ className }: { className?: string }) {
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<string[]>([]);

  const stage = (files: FileList | null) => {
    if (!files?.length) return;
    setStaged((prev) => [...prev, ...Array.from(files).map((f) => f.name)].slice(0, 10));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Lock className="h-4 w-4 text-teal" aria-hidden />
        Secure Clinical Document Upload
      </span>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          stage(e.dataTransfer.files);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors",
          dragging
            ? "border-teal bg-teal/10"
            : "border-navy/25 bg-ice/60 hover:border-teal/60 hover:bg-teal/5",
        )}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff"
          className="sr-only"
          onChange={(e) => stage(e.target.files)}
        />
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal/15 text-teal">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-navy">
          Drag &amp; Drop or Click to Upload Patient Charts
        </span>
        <span className="text-xs text-slate-ink/75">
          Accepted formats: Secure PDFs, Word Docs, Image Scans
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1 text-[0.7rem] font-medium text-slate-ink">
          <Lock className="h-3 w-3 text-teal" aria-hidden />
          Max file size 25MB per document · AES-256 secured
        </span>
      </label>

      {staged.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Staged documents">
          {staged.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs font-medium text-navy"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span className="truncate">{name}</span>
              <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-wide text-teal">
                Staged
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-ink/80">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
        <span>
          <span className="font-semibold text-navy">Recommended uploads for expedited RN clinical review:</span>{" "}
          {RECOMMENDED_UPLOADS.join(", ")}.
        </span>
      </p>
    </div>
  );
}
