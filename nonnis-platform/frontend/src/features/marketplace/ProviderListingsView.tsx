"use client";

import Link from "next/link";
import Image from "next/image";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { formatListingPrice, listingStatusTone, listingTypeLabel, transactionLabel } from "@/lib/marketplace";
import { listProviderListings, setProviderListingStatus } from "@/services/marketplace.service";
import type { MarketplaceListing } from "@/types/marketplace";

export function ProviderListingsView() {
  const state = useAsync(() => listProviderListings({ page: 1 }), []);

  const columns: Column<MarketplaceListing>[] = [
    {
      key: "listing",
      header: "Listing",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
            {row.primaryImageUrl ? (
              <Image src={row.primaryImageUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
            ) : null}
          </span>
          <span className="min-w-0">
            <Link href={`/provider/listings/${row.id}`} className="block truncate font-medium text-brand-700 hover:underline">
              {row.title}
            </Link>
            <span className="block text-xs text-slate-500">
              {listingTypeLabel(row.listingType)} · {transactionLabel(row.transactionType)}
            </span>
          </span>
        </div>
      ),
    },
    { key: "price", header: "Price", render: (row) => <span className="tabular-nums">{formatListingPrice(row)}</span> },
    {
      key: "quantity",
      header: "Available",
      render: (row) => (
        <span className={row.availableQuantity === 0 ? "font-medium text-rose-600" : "tabular-nums text-slate-700"}>
          {row.availableQuantity === 0 ? "Sold out" : row.availableQuantity}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={listingStatusTone(row.status)} /> },
    { key: "updated", header: "Updated", render: (row) => <span className="text-xs text-slate-500">{formatDate(row.updatedAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          {row.status === "PUBLISHED" ? (
            <MutationButton
              variant="link"
              pendingLabel="Updating…"
              action={() => setProviderListingStatus(row.id, "UNAVAILABLE")}
              successToast="Listing taken off the marketplace"
              onSuccess={() => state.reload()}
            >
              Unpublish
            </MutationButton>
          ) : row.status !== "ARCHIVED" ? (
            <MutationButton
              variant="link"
              className="text-brand-700 hover:text-brand-800"
              pendingLabel="Publishing…"
              action={() => setProviderListingStatus(row.id, "PUBLISHED")}
              successToast="Listing published"
              onSuccess={() => state.reload()}
            >
              Publish
            </MutationButton>
          ) : null}
          <Link href={`/provider/listings/${row.id}`} className="text-sm font-medium text-slate-500 hover:text-umber">
            Edit
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Listings"
        description="Beds, rooms and units you offer directly to families. Separate from referrals."
        actions={
          <Link
            href="/provider/listings/new"
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            Add listing
          </Link>
        }
      />
      <Panel title="Your listings">
        {state.loading ? (
          <LoadingState label="Loading listings…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : !state.data || state.data.items.length === 0 ? (
          <EmptyState title="No listings yet" message="Add a bed, room or unit to offer it on the marketplace." />
        ) : (
          <DataTable columns={columns} rows={state.data.items} getRowKey={(row) => row.id} />
        )}
      </Panel>
    </div>
  );
}
