"use client";

import { useRef, useState } from "react";
import { Lock, UploadCloud, FileText, Lightbulb, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECOMMENDED_UPLOADS } from "@/data/hospitalReferral";

/**
 * Secure clinical document staging target. Presentational only — no file is
 * read, stored, or transmitted (frontend-only build). Files are validated and
 * held in local component state so the interaction feels real, but nothing
 * leaves the browser. The AES-256 / HIPAA framing describes the intended
 * secure pipeline, not a live upload.
 */

const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif";
const ALLOWED_EXT = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const extOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};
const sizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function SecureDocumentUpload({ className }: { className?: string }) {
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const nextErrors: string[] = [];
    const accepted: File[] = [];

    for (const file of incoming) {
      if (!ALLOWED_EXT.includes(extOf(file.name))) {
        nextErrors.push(`${file.name} is not an accepted format. Please upload a PDF, Word Doc, or image scan.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        nextErrors.push(`${file.name} is larger than 25 MB.`);
        continue;
      }
      accepted.push(file);
    }

    const room = MAX_FILES - staged.length;
    if (accepted.length > room) {
      nextErrors.push("You can upload up to 5 documents only.");
    }
    const toAdd = accepted.slice(0, Math.max(0, room));
    if (toAdd.length) setStaged((prev) => [...prev, ...toAdd]);
    setErrors(nextErrors);

    // Allow re-selecting the same file after a removal.
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
    setErrors([]);
  };

  const atLimit = staged.length >= MAX_FILES;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Lock className="h-4 w-4 text-teal" aria-hidden />
        Secure Clinical Document Upload
      </span>

      <label
        onDragOver={(e) => {
          if (atLimit) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!atLimit) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors",
          atLimit
            ? "cursor-not-allowed border-navy/20 bg-navy/5 opacity-70"
            : dragging
              ? "cursor-pointer border-teal bg-teal/10"
              : "cursor-pointer border-navy/25 bg-ice/60 hover:border-teal/60 hover:bg-teal/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={atLimit}
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal/15 text-teal">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-navy">
          Drag &amp; Drop or Click to Upload Patient Charts
        </span>
        <span className="text-xs font-medium text-slate-ink">Upload up to 5 documents. 25 MB max each.</span>
        <span className="text-xs text-slate-ink/75">Accepted formats: Secure PDFs, Word Docs, Image Scans.</span>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1 text-[0.7rem] font-medium text-slate-ink">
          <Lock className="h-3 w-3 text-teal" aria-hidden />
          AES-256 secured
        </span>
      </label>

      {errors.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {errors.map((msg, i) => (
            <li key={`${msg}-${i}`} className="flex items-start gap-2 rounded-lg border border-coral/25 bg-coral/[0.06] px-3 py-2 text-xs font-medium text-coral" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{msg}</span>
            </li>
          ))}
        </ul>
      )}

      {staged.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Staged documents">
          {staged.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs font-medium text-navy"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span className="truncate">{file.name}</span>
              <span className="ml-auto shrink-0 text-[0.65rem] text-slate-ink/70">{sizeLabel(file.size)}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded-full p-1 text-slate-ink/60 transition-colors hover:bg-coral/10 hover:text-coral"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
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
