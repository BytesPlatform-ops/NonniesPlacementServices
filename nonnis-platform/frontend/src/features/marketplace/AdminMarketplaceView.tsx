"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  formatListingPrice,
  formatMoney,
  listingStatusTone,
  orderProgressLabel,
  orderStatusTone,
  transactionLabel,
} from "@/lib/marketplace";
import {
  adminListListings,
  adminListOrders,
  adminModerateListing,
  adminRecordCashPayment,
} from "@/services/marketplace.service";
import type { MarketplaceListing, MarketplaceOrder } from "@/types/marketplace";

export function AdminMarketplaceView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.MARKETPLACE_ADMIN_MANAGE);
  const [tab, setTab] = useState<"listings" | "orders">("listings");
  const listings = useAsync(() => adminListListings({ page: 1 }), []);
  const orders = useAsync(() => adminListOrders({ page: 1 }), []);

  const listingColumns: Column<MarketplaceListing>[] = [
    {
      key: "listing",
      header: "Listing",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">{row.provider.name}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (row) => <span className="text-slate-600">{transactionLabel(row.transactionType)}</span> },
    { key: "price", header: "Price", render: (row) => <span className="tabular-nums">{formatListingPrice(row)}</span> },
    { key: "qty", header: "Available", render: (row) => <span className="tabular-nums">{row.availableQuantity}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={listingStatusTone(row.status)} /> },
    { key: "created", header: "Created", render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span> },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (row: MarketplaceListing) =>
              row.status === "ARCHIVED" ? null : (
                <MutationButton
                  variant="danger-link"
                  pendingLabel="Removing…"
                  confirm={{
                    title: "Take this listing down?",
                    description: "It comes off the marketplace immediately. Only the provider can publish it again.",
                    confirmLabel: "Take down",
                    variant: "danger",
                  }}
                  action={() => adminModerateListing(row.id, "UNAVAILABLE")}
                  successToast="Listing taken down"
                  onSuccess={() => listings.reload()}
                >
                  Take down
                </MutationButton>
              ),
          },
        ]
      : []),
  ];

  const orderColumns: Column<MarketplaceOrder>[] = [
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.orderNumber}</p>
          <p className="text-xs text-slate-500">{row.listingTitle}</p>
        </div>
      ),
    },
    { key: "provider", header: "Provider", render: (row) => <span className="text-slate-600">{row.provider.name}</span> },
    { key: "type", header: "Type", render: (row) => <span className="text-slate-600">{transactionLabel(row.transactionType)}</span> },
    { key: "qty", header: "Qty", render: (row) => <span className="tabular-nums">{row.quantity}</span> },
    { key: "total", header: "Total", render: (row) => <span className="tabular-nums">{formatMoney(row.totalAmount, row.currency)}</span> },
    { key: "payment", header: "Payment", render: (row) => <span className="text-slate-600">Cash · {row.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={orderProgressLabel(row)} tone={orderStatusTone(row.status)} /> },
    { key: "created", header: "Created", render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span> },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (row: MarketplaceOrder) =>
              row.paymentStatus === "UNPAID" && (row.status === "ACCEPTED" || row.status === "ACTIVE") ? (
                <MutationButton
                  variant="link"
                  className="text-brand-700 hover:text-brand-800"
                  pendingLabel="Recording…"
                  confirm={{
                    title: "Record the cash payment?",
                    description: `Authorized override for ${row.orderNumber}. Use it when the provider cannot record it themselves.`,
                    confirmLabel: "Mark cash received",
                  }}
                  action={() => adminRecordCashPayment(row.id)}
                  successToast="Payment recorded"
                  onSuccess={() => orders.reload()}
                >
                  Mark cash received
                </MutationButton>
              ) : null,
          },
        ]
      : []),
  ];

  const active = tab === "listings" ? listings : orders;

  return (
    <div className="space-y-6">
      <PageHeading title="Marketplace" description="Provider-listed beds and rooms, and the orders families place against them." />
      <div className="flex gap-2 border-b border-sage">
        {(["listings", "orders"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-umber"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Panel>
        {active.loading ? (
          <LoadingState label="Loading…" />
        ) : active.error ? (
          <ErrorState message={active.error.message} onRetry={active.reload} />
        ) : tab === "listings" ? (
          (listings.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No listings" message="Providers have not listed anything yet." />
          ) : (
            <DataTable columns={listingColumns} rows={listings.data?.items ?? []} getRowKey={(r) => r.id} />
          )
        ) : (orders.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No orders" message="Marketplace orders appear here as families place them." />
        ) : (
          <DataTable columns={orderColumns} rows={orders.data?.items ?? []} getRowKey={(r) => r.id} />
        )}
      </Panel>
    </div>
  );
}
