"use client";

import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/providers/toast-provider";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { MediaUpload } from "@/features/content/MediaUpload";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, type MediaValue, deleteProviderImage, uploadProviderImage } from "@/services/media.service";
import { publishProvider, unpublishProvider, updatePublicListing } from "@/services/providers.service";
import type { ProviderDetailView } from "@/types/providers";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/** Client slug suggestion (backend re-validates + enforces uniqueness). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function PublicListingTab({ provider, reload }: { provider: ProviderDetailView; reload: () => void }) {
  const pl = provider.publicListing;
  const toast = useToast();

  const [form, setForm] = useState({
    isResidentialProvider: pl.isResidentialProvider,
    publicSlug: pl.slug ?? "",
    publicDescription: pl.description ?? "",
    publicSortOrder: pl.sortOrder != null ? String(pl.sortOrder) : "",
  });
  const [image, setImage] = useState<MediaValue>({ url: pl.featuredImageUrl, storagePath: pl.featuredImageStoragePath });
  const initialImagePath = useRef(pl.featuredImageStoragePath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = pl.slug ? `${PUBLIC_SITE_URL}/residential-providers/${pl.slug}` : null;
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updatePublicListing(provider.id, {
        isResidentialProvider: form.isResidentialProvider,
        publicSlug: form.publicSlug.trim() || undefined,
        publicDescription: form.publicDescription.trim() || undefined,
        publicFeaturedImageUrl: image.url,
        publicFeaturedImageStoragePath: image.storagePath,
        publicSortOrder: form.publicSortOrder ? Number(form.publicSortOrder) : undefined,
      });
      initialImagePath.current = image.storagePath;
      toast.success("Public listing saved");
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the public listing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <Panel
        title="Website Listing"
        description="Control whether this residential provider appears in the public directory. Publishing is Nonnis-managed."
        actions={
          <StatusBadge
            label={pl.published ? "Published" : pl.ready ? "Ready to publish" : "Not published"}
            tone={pl.published ? "positive" : pl.ready ? "info" : "neutral"}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          {pl.published ? (
            <>
              <MutationButton
                variant="danger"
                action={() => unpublishProvider(provider.id)}
                confirm={{
                  title: "Remove from the website?",
                  description: "This provider will immediately disappear from the public residential directory.",
                  confirmLabel: "Unpublish",
                  variant: "danger",
                }}
                successToast="Removed from the website"
                onSuccess={reload}
              >
                Unpublish
              </MutationButton>
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  View on website <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </>
          ) : (
            <MutationButton
              variant="primary"
              action={() => publishProvider(provider.id)}
              confirm={{
                title: "Publish to the website?",
                description: "This provider will appear in the public residential directory for families to find.",
                confirmLabel: "Publish",
              }}
              successToast="Published to the website"
              errorToast="Could not publish — complete the required information first"
              onSuccess={reload}
              disabled={!pl.ready}
            >
              Publish to website
            </MutationButton>
          )}
          {pl.publishedAt ? (
            <span className="text-xs text-slate-500">Last published {formatDateTime(pl.publishedAt)}</span>
          ) : null}
        </div>

        {!pl.ready ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <p className="font-medium">Complete the following before publishing:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {pl.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      {/* Editor */}
      <Panel title="Listing details">
        {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isResidentialProvider}
            onChange={(e) => set("isResidentialProvider", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          This is a residential provider (required for the public directory)
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Public URL slug</span>
            <div className="flex items-center gap-2">
              <input
                value={form.publicSlug}
                onChange={(e) => set("publicSlug", e.target.value)}
                placeholder="sunrise-senior-living"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => set("publicSlug", slugify(provider.displayName))}
                className="mt-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Suggest
              </button>
            </div>
            <span className="mt-1 block text-xs text-slate-400">/residential-providers/{form.publicSlug || "…"}</span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Display order (optional)</span>
            <input
              type="number"
              min={0}
              value={form.publicSortOrder}
              onChange={(e) => set("publicSortOrder", e.target.value)}
              placeholder="Lower shows first"
              className={inputCls}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">Public description</span>
          <textarea
            value={form.publicDescription}
            onChange={(e) => set("publicDescription", e.target.value)}
            rows={4}
            placeholder="A warm, family-friendly summary shown on the public listing. Falls back to the provider description when empty."
            className={inputCls}
          />
        </label>

        <div className="mt-4">
          <MediaUpload
            label="Featured image"
            accept={IMAGE_ACCEPT}
            maxBytes={MAX_IMAGE_BYTES}
            variant="image"
            value={image}
            initialStoragePath={initialImagePath.current}
            onChange={setImage}
            uploader={(file, onProgress) => uploadProviderImage(provider.id, file, onProgress)}
            deleter={(path) => deleteProviderImage(provider.id, path)}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save listing"}
          </button>
        </div>
      </Panel>
    </div>
  );
}
