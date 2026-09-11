"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { listingStatusTone } from "@/lib/marketplace";
import {
  addProviderListingImage,
  createProviderListing,
  getProviderListing,
  removeProviderListingImage,
  uploadListingImage,
  setProviderListingStatus,
  updateProviderListing,
} from "@/services/marketplace.service";
import {
  ListingFormFields,
  emptyListingForm,
  toListingInput,
  validateListingForm,
  type ListingFormState,
} from "./ListingForm";

/** Create and edit share one editor: the only difference is whether an id exists. */
export function ProviderListingEditor({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const existing = useAsync(() => (listingId ? getProviderListing(listingId) : Promise.resolve(null)), [listingId]);
  const [form, setForm] = useState<ListingFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (listingId && existing.loading) return <LoadingState label="Loading listing…" />;
  if (listingId && existing.error) return <ErrorState message={existing.error.message} onRetry={existing.reload} />;

  const listing = existing.data ?? null;
  const state = form ?? emptyListingForm(listing ?? undefined);

  const save = async (publish: boolean) => {
    const invalid = validateListingForm(state);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input = toListingInput(state);
      const saved = listing ? await updateProviderListing(listing.id, input) : await createProviderListing(input);
      if (publish) await setProviderListingStatus(saved.id, "PUBLISHED");
      toast.success(publish ? "Listing published" : "Listing saved");
      router.push(`/provider/listings/${saved.id}`);
      router.refresh();
    } catch (err) {
      // The server is the authority on the commercial rules, so its message is
      // more useful here than a generic one.
      setError(err instanceof Error && err.message ? err.message : "The listing could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file || !listing) return;
    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadListingImage(file);
      await addProviderListingImage(listing.id, { imageUrl, storagePath });
      toast.success("Image added");
      await existing.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={listing ? listing.title : "New listing"}
        description={listing ? "Edit this listing, then publish it when it is ready." : "Save it as a draft, or publish straight away."}
        actions={listing ? <StatusBadge label={listing.status} tone={listingStatusTone(listing.status)} /> : undefined}
      />

      <ListingFormFields form={state} onChange={setForm} />

      {listing ? (
        <Panel title="Photos" description="The first photo is used as the listing's cover.">
          <div className="flex flex-wrap items-center gap-3">
            {listing.images.map((img) => (
              <div key={img.id} className="relative">
                <span className="relative block h-24 w-32 overflow-hidden rounded-md bg-slate-100">
                  <Image src={img.imageUrl} alt={img.altText ?? ""} fill className="object-cover" sizes="128px" unoptimized />
                </span>
                <MutationButton
                  variant="danger-link"
                  pendingLabel="Removing…"
                  confirm={{ title: "Remove this photo?", description: "It will no longer appear on the listing.", confirmLabel: "Remove", variant: "danger" }}
                  action={() => removeProviderListingImage(listing.id, img.id)}
                  successToast="Photo removed"
                  onSuccess={() => existing.reload()}
                >
                  Remove
                </MutationButton>
              </div>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void onPickImage(e.target.files?.[0])}
              />
              {uploading ? "Uploading…" : "Add photo"}
            </label>
          </div>
        </Panel>
      ) : null}

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {saving ? "Saving…" : listing ? "Save changes" : "Save as draft"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(true)}
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          Save and publish
        </button>
        {listing && listing.status !== "ARCHIVED" ? (
          <MutationButton
            variant="danger-link"
            pendingLabel="Archiving…"
            confirm={{
              title: "Archive this listing?",
              description: "It comes off the marketplace and out of your active list. Existing orders are not affected.",
              confirmLabel: "Archive listing",
              variant: "danger",
            }}
            action={() => setProviderListingStatus(listing.id, "ARCHIVED")}
            successToast="Listing archived"
            onSuccess={() => router.push("/provider/listings")}
          >
            Archive
          </MutationButton>
        ) : null}
      </div>
    </div>
  );
}
