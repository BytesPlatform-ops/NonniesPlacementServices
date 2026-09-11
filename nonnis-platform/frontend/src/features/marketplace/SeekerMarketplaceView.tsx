"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { formatListingPrice, listingTypeLabel, transactionLabel } from "@/lib/marketplace";
import { browseMarketplace } from "@/services/marketplace.service";
import type { MarketplaceListing } from "@/types/marketplace";

const selectCls = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700";

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <Link
      href={`/seeker/marketplace/${listing.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-sage bg-ivory shadow-card transition hover:border-brand-700/40 hover:shadow-md"
    >
      <span className="relative block h-40 w-full bg-slate-100">
        {listing.primaryImageUrl ? (
          <Image src={listing.primaryImageUrl} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 320px" unoptimized />
        ) : null}
        <span className="absolute left-2 top-2">
          <StatusBadge label={transactionLabel(listing.transactionType)} tone={listing.transactionType === "RENT" ? "info" : "progress"} />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="text-sm font-semibold text-umber">{listing.title}</span>
        <span className="mt-0.5 text-xs text-slate-500">
          {listing.provider.name}
          {listing.city ? ` · ${[listing.city, listing.state].filter(Boolean).join(", ")}` : ""}
        </span>
        <span className="mt-2 text-base font-semibold tabular-nums text-umber">{formatListingPrice(listing)}</span>
        <span className="mt-1 text-xs text-slate-500">
          {listingTypeLabel(listing.listingType)} · {listing.availableQuantity} available
          {listing.availableFrom ? ` · from ${formatDate(listing.availableFrom)}` : ""}
        </span>
        {listing.description ? (
          <span className="mt-2 line-clamp-2 text-xs text-slate-600">{listing.description}</span>
        ) : null}
        <span className="mt-3 text-sm font-medium text-brand-700">View details →</span>
      </span>
    </Link>
  );
}

export function SeekerMarketplaceView() {
  const [transactionType, setTransactionType] = useState("");
  const [listingType, setListingType] = useState("");
  const [city, setCity] = useState("");
  const state = useAsync(
    () => browseMarketplace({ page: 1, transactionType: transactionType || undefined, listingType: listingType || undefined, city: city || undefined }),
    [transactionType, listingType, city],
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="Marketplace"
        description="Beds, rooms and units listed directly by providers. Open to browse — you do not need a referral."
      />
      <Panel
        title="Available now"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className={selectCls}>
              <option value="">Rent or buy</option>
              <option value="RENT">For rent</option>
              <option value="SALE">For sale</option>
            </select>
            <select value={listingType} onChange={(e) => setListingType(e.target.value)} className={selectCls}>
              <option value="">Any type</option>
              <option value="BED">Bed</option>
              <option value="PRIVATE_ROOM">Private room</option>
              <option value="SHARED_ROOM">Shared room</option>
              <option value="UNIT">Unit</option>
            </select>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-28 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
        }
      >
        {state.loading ? (
          <LoadingState label="Loading the marketplace…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Nothing listed right now" message="Providers add beds and rooms here as they become available." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.data?.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
