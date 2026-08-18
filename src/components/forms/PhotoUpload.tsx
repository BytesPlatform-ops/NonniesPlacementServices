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
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per source photo (before optimization)
// Photos are downscaled + re-encoded in the browser; this caps the COMBINED
// optimized payload (in raw bytes) so that once base64-encoded (~+33%) the
// submission body stays comfortably under host request-body limits
// (Netlify/serverless functions reject bodies larger than ~6 MB).
const MAX_PAYLOAD_BYTES = 3.5 * 1024 * 1024; // ~4.6 MB once base64-encoded
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif";
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const extOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};
const sizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Read a file/blob into base64 (no `data:` prefix) for transmission with the form. */
function readAsBase64(file: Blob): Promise<string> {
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

/**
 * Downscale + re-encode an image to JPEG in the browser so the upload payload
 * stays small. Returns null if the image can't be decoded (e.g. HEIC on a
 * non-Safari browser), letting the caller fall back to the original bytes.
 */
async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<{ content: string; size: number; type: string; blob: Blob } | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // undecodable format (e.g. HEIC outside Safari)
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return null;
  const content = await readAsBase64(blob);
  return { content, size: blob.size, type: "image/jpeg", blob };
}

type StagedPhoto = { name: string; size: number; type: string; content: string; preview: string };

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
    onPhotosChange?.(items.map(({ name, size, type, content }) => ({ name, size, type, content })));

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const nextErrors: string[] = [];
    const accepted: File[] = [];

    for (const file of incoming) {
      if (!ALLOWED_EXT.includes(extOf(file.name))) {
        nextErrors.push(`${file.name} is not an accepted image. Please upload a JPG, PNG, WebP, or HEIC photo.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        nextErrors.push(`${file.name} is larger than 10 MB.`);
        continue;
      }
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
      const processed: StagedPhoto[] = await Promise.all(
        toAdd.map(async (file) => {
          const compressed = await compressImage(file);
          if (compressed) {
            const name = file.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, "") + ".jpg";
            return { name, size: compressed.size, type: "image/jpeg", content: compressed.content, preview: URL.createObjectURL(compressed.blob) };
          }
          // Couldn't decode/compress — fall back to the original bytes.
          return { name: file.name, size: file.size, type: file.type, content: await readAsBase64(file), preview: URL.createObjectURL(file) };
        }),
      );

      // Keep the combined (optimized) payload under the host request-body limit.
      let total = staged.reduce((sum, p) => sum + p.size, 0);
      const kept: StagedPhoto[] = [];
      let overflow = false;
      for (const p of processed) {
        if (total + p.size > MAX_PAYLOAD_BYTES) {
          overflow = true;
          URL.revokeObjectURL(p.preview);
          continue;
        }
        total += p.size;
        kept.push(p);
      }
      if (overflow) {
        nextErrors.push("Some photos were skipped to keep the upload small enough to send. Try fewer photos, or upload the rest in a second submission.");
      }

      const nextStaged = [...staged, ...kept];
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
        <p className="text-xs text-slate-ink/70">PNG, JPG, WebP, or HEIC · up to {MAX_FILES} photos · optimized before upload</p>
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
          {staged.map(({ name, size, preview }, i) => (
            <li key={`${name}-${i}`} className="group relative overflow-hidden rounded-xl border border-navy/10 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote asset */}
              <img src={preview} alt={name} className="aspect-square w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-navy/70 px-1.5 py-0.5 text-[0.6rem] font-medium text-white">
                {sizeLabel(size)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${name}`}
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
