"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { deleteMedia, uploadMedia, type MediaKind, type MediaValue } from "@/services/media.service";

/**
 * Reusable media uploader for CMS images/videos. Uploads directly to Supabase
 * Storage via a backend-minted signed URL, shows progress, and previews the
 * result from its real public URL. Replacing/removing a not-yet-saved upload
 * cleans up its orphaned object; server-persisted media is cleaned up by the
 * backend on save.
 */
export function MediaUpload({
  label,
  kind,
  accept,
  maxBytes,
  variant,
  value,
  initialStoragePath,
  onChange,
  uploader,
  deleter,
}: {
  label: string;
  kind?: MediaKind;
  accept: string;
  maxBytes: number;
  variant: "image" | "video";
  value: MediaValue;
  initialStoragePath: string | null;
  onChange: (value: MediaValue) => void;
  /** Custom upload/delete (e.g. provider-scoped endpoints); defaults to the CMS media endpoints. */
  uploader?: (file: File, onProgress?: (pct: number) => void) => Promise<MediaValue>;
  deleter?: (storagePath: string) => Promise<void>;
}) {
  const doUpload = uploader ?? ((file: File, onProgress?: (pct: number) => void) => uploadMedia(kind ?? "blog-featured", file, onProgress));
  const doDelete = deleter ?? deleteMedia;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** A storage path counts as "session-owned" (deletable now) if it differs from what was loaded. */
  const isSessionUpload = (path: string | null) => !!path && path !== initialStoragePath;

  const pick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const onFile = async (file: File) => {
    if (file.size > maxBytes) {
      setError(`File is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB).`);
      return;
    }
    const previous = value.storagePath;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const result = await doUpload(file, setProgress);
      onChange(result);
      if (isSessionUpload(previous) && previous) await doDelete(previous); // drop the replaced orphan
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    const current = value.storagePath;
    onChange({ url: null, storagePath: null });
    if (isSessionUpload(current) && current) await doDelete(current);
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>

      <div className="mt-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
        {value.url ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border border-sage bg-white">
              {variant === "video" ? (
                <video src={value.url} poster={undefined} controls preload="metadata" className="max-h-56 w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.url} alt={`${label} preview`} className="max-h-56 w-full object-cover" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={pick} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <Upload className="h-4 w-4" aria-hidden /> Replace
              </button>
              <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={pick} className="flex w-full flex-col items-center justify-center gap-2 rounded-md px-4 py-8 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-60">
            <Upload className="h-6 w-6 text-slate-400" aria-hidden />
            <span className="font-medium text-slate-600">Upload {variant === "video" ? "video" : "image"}</span>
            <span className="text-xs text-slate-400">Stored in Supabase and served over CDN.</span>
          </button>
        )}

        {busy ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Uploading… {progress}%
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" aria-hidden /> {error}</span>
            <button type="button" onClick={pick} className="inline-flex items-center gap-1 font-medium hover:underline">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
            </button>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
    </div>
  );
}
