"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubmissionFile } from "@/lib/forms/submitForm";

/**
 * Functional multi-photo upload for the provider listing form. Providers can
 * add several photos of their home/facility; each is validated and read into
 * base64 so the submission carries the real images (delivered to the inbox as
 * email attachments over TLS). Thumbnails preview the selection before submit.
 */

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per photo
// Mail servers cap total message size (Google Workspace ~25 MB), so guard the
// combined payload to keep submissions deliverable.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB across all photos
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif";
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const extOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};
const sizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Read a file into base64 (no `data:` prefix) for transmission with the form. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

type StagedPhoto = { file: File; content: string; preview: string };

export function PhotoUpload({
  label,
  className,
  onPhotosChange,
}: {
  label: string;
  className?: string;
  onPhotosChange?: (photos: SubmissionFile[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track the latest staged list in a ref so the unmount cleanup can revoke
  // every outstanding object URL without re-running on each change.
  const stagedRef = useRef<StagedPhoto[]>([]);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(() => {
    return () => {
      for (const p of stagedRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

  const emit = (items: StagedPhoto[]) =>
    onPhotosChange?.(items.map(({ file, content }) => ({ name: file.name, size: file.size, type: file.type, content })));

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const nextErrors: string[] = [];
    const accepted: File[] = [];

    let runningTotal = staged.reduce((sum, s) => sum + s.file.size, 0);
    for (const file of incoming) {
      if (!ALLOWED_EXT.includes(extOf(file.name))) {
        nextErrors.push(`${file.name} is not an accepted image. Please upload a JPG, PNG, WebP, or HEIC photo.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        nextErrors.push(`${file.name} is larger than 10 MB.`);
        continue;
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        nextErrors.push(`${file.name} exceeds the 20 MB combined upload limit. Remove a photo or send it separately.`);
        continue;
      }
      runningTotal += file.size;
      accepted.push(file);
    }

    const room = MAX_FILES - staged.length;
    if (accepted.length > room) {
      nextErrors.push(`You can upload up to ${MAX_FILES} photos only.`);
    }
    const toAdd = accepted.slice(0, Math.max(0, room));

    // Allow re-selecting the same file after a removal.
    if (inputRef.current) inputRef.current.value = "";

    if (!toAdd.length) {
      setErrors(nextErrors);
      return;
    }

    try {
      const read = await Promise.all(
        toAdd.map(async (file) => ({ file, content: await readAsBase64(file), preview: URL.createObjectURL(file) })),
      );
      const nextStaged = [...staged, ...read];
      setStaged(nextStaged);
      setErrors(nextErrors);
      emit(nextStaged);
    } catch {
      setErrors([...nextErrors, "One or more photos could not be read. Please try again."]);
    }
  };

  const remove = (index: number) => {
    const target = staged[index];
    if (target) URL.revokeObjectURL(target.preview);
    const nextStaged = staged.filter((_, i) => i !== index);
    setStaged(nextStaged);
    setErrors([]);
    emit(nextStaged);
  };

  const atLimit = staged.length >= MAX_FILES;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <span className="text-sm font-semibold text-navy">{label}</span>

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
          if (!atLimit) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          atLimit
            ? "cursor-not-allowed border-navy/20 bg-navy/5 opacity-70"
            : dragging
              ? "border-blue bg-blue/10"
              : "border-navy/20 bg-ice/50 hover:border-blue/50 hover:bg-blue/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={atLimit}
          className="sr-only"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <ImagePlus className="h-8 w-8 text-blue" aria-hidden />
        <p className="text-sm font-medium text-navy">Drag photos here or browse</p>
        <p className="text-xs text-slate-ink/70">PNG, JPG, WebP, or HEIC · up to 10MB each · {MAX_FILES} photos max</p>
      </label>

      {errors.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {errors.map((msg, i) => (
            <li
              key={`${msg}-${i}`}
              className="flex items-start gap-2 rounded-lg border border-coral/25 bg-coral/[0.06] px-3 py-2 text-xs font-medium text-coral"
              role="alert"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{msg}</span>
            </li>
          ))}
        </ul>
      )}

      {staged.length > 0 && (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4" aria-label="Selected photos">
          {staged.map(({ file, preview }, i) => (
            <li key={`${file.name}-${i}`} className="group relative overflow-hidden rounded-xl border border-navy/10 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote asset */}
              <img src={preview} alt={file.name} className="aspect-square w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-navy/70 px-1.5 py-0.5 text-[0.6rem] font-medium text-white">
                {sizeLabel(file.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-ink/70 shadow-sm transition-colors hover:bg-coral/10 hover:text-coral"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
