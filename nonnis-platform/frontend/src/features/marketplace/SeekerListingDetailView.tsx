"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { formatListingPrice, formatMoney, listingTypeLabel, transactionLabel } from "@/lib/marketplace";
import { createMarketplaceOrder, getMarketplaceListing } from "@/services/marketplace.service";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800";

export function SeekerListingDetailView({ listingId }: { listingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const state = useAsync(() => getMarketplaceListing(listingId), [listingId]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.loading) return <LoadingState label="Loading listing…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return <EmptyState title="Listing not found" />;

  const listing = state.data;
  const isRent = listing.transactionType === "RENT";
  const total = (Number(listing.price) * quantity).toFixed(2);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createMarketplaceOrder({
        listingId: listing.id,
        quantity,
        note: note.trim() || undefined,
        requestedStartDate: isRent && start ? start : undefined,
        requestedEndDate: isRent && end ? end : undefined,
      });
      toast.success("Your request has been sent to the provider.");
      router.push("/seeker/orders");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={listing.title}
        description={`${listing.provider.name}${listing.city ? ` · ${[listing.city, listing.state].filter(Boolean).join(", ")}` : ""}`}
        breadcrumb={
          <Link href="/seeker/marketplace" className="hover:underline">
            ← Back to the marketplace
          </Link>
        }
        actions={<StatusBadge label={transactionLabel(listing.transactionType)} tone={isRent ? "info" : "progress"} />}
      />

      {listing.images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {listing.images.slice(0, 3).map((img, index) => (
            <div key={img.id} className={`relative h-48 overflow-hidden rounded-lg bg-slate-100 ${index === 0 ? "sm:col-span-2 sm:h-64" : ""}`}>
              <Image src={img.imageUrl} alt={img.altText ?? listing.title} fill className="object-cover" sizes="(max-width:768px) 100vw, 480px" unoptimized />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {listing.description ? (
            <Panel title="About this listing">
              <p className="text-sm leading-relaxed text-slate-700">{listing.description}</p>
            </Panel>
          ) : null}
          <Panel title="Details">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Type</dt>
                <dd className="text-sm font-medium text-slate-800">{listingTypeLabel(listing.listingType)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Price</dt>
                <dd className="text-sm font-medium text-slate-800">{formatListingPrice(listing)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Available</dt>
                <dd className="text-sm font-medium text-slate-800">{listing.availableQuantity}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Available from</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {listing.availableFrom ? formatDate(listing.availableFrom) : "Now"}
                </dd>
              </div>
              {listing.depositAmount ? (
                <div>
                  <dt className="text-xs text-slate-500">Deposit</dt>
                  <dd className="text-sm font-medium text-slate-800">
                    {formatMoney(listing.depositAmount, listing.currency)}
                    <span className="ml-1 text-xs font-normal text-slate-500">(arranged with the provider)</span>
                  </dd>
                </div>
              ) : null}
              {listing.addressLine1 ? (
                <div>
                  <dt className="text-xs text-slate-500">Address</dt>
                  <dd className="text-sm font-medium text-slate-800">{listing.addressLine1}</dd>
                </div>
              ) : null}
              {listing.restrictions ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Please note</dt>
                  <dd className="text-sm font-medium text-slate-800">{listing.restrictions}</dd>
                </div>
              ) : null}
            </dl>
            {listing.amenities.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.amenities.map((a) => (
                  <span key={a} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {a}
                  </span>
                ))}
              </div>
            ) : null}
          </Panel>
        </div>

        <Panel
          title={isRent ? "Request to rent" : "Request to buy"}
          description="Payment is arranged directly with the provider in cash. Nothing is charged here."
        >
          {listing.soldOut ? (
            <EmptyState title="Sold out" message="There is nothing available on this listing right now." />
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={listing.availableQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(listing.availableQuantity, Number(e.target.value) || 1)))}
                  className={inputCls}
                />
              </label>
              {isRent ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Preferred start</span>
                    <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Until (optional)</span>
                    <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                  </label>
                </div>
              ) : null}
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Anything to add? (optional)</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
              </label>

              <dl className="space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Unit price</dt>
                  <dd className="tabular-nums font-medium">{formatListingPrice(listing)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Quantity</dt>
                  <dd className="tabular-nums font-medium">{quantity}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <dt className="text-slate-600">{isRent ? "Per period total" : "Total"}</dt>
                  <dd className="tabular-nums font-semibold">{formatMoney(total, listing.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Payment</dt>
                  <dd className="font-medium">Cash / offline</dd>
                </div>
              </dl>

              {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="w-full rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? "Sending…" : isRent ? "Request to rent" : "Request to buy"}
              </button>
              <p className="text-xs text-slate-500">
                Sending a request does not reserve anything yet — the provider confirms first.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
