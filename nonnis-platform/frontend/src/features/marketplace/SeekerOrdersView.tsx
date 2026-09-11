"use client";

import Image from "next/image";
import Link from "next/link";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney, listingTypeLabel, orderProgressLabel, orderStatusTone, transactionLabel } from "@/lib/marketplace";
import { cancelMyMarketplaceOrder, listMyMarketplaceOrders } from "@/services/marketplace.service";
import type { MarketplaceOrder } from "@/types/marketplace";

/** What the family should do or expect next, in one sentence. */
function nextStep(order: MarketplaceOrder): string | null {
  if (order.status === "REQUESTED") return "Waiting for the provider to answer. Nothing is reserved yet.";
  if (order.status === "ACCEPTED" && order.paymentStatus === "UNPAID") {
    return "The provider accepted. Arrange the cash payment with them directly.";
  }
  if (order.status === "ACCEPTED" && order.paymentStatus === "PAID") return "Payment received. The provider will confirm the rest.";
  if (order.status === "ACTIVE") return "Your rental is active.";
  if (order.status === "COMPLETED") return "This order is complete.";
  if (order.status === "DECLINED") return "The provider could not take this one.";
  return null;
}

export function SeekerOrdersView() {
  const state = useAsync(() => listMyMarketplaceOrders({ page: 1 }), []);

  return (
    <div className="space-y-6">
      <PageHeading
        title="My orders"
        description="Your marketplace requests. Payment is arranged directly with the provider."
        actions={
          <Link href="/seeker/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
            Browse the marketplace
          </Link>
        }
      />
      <Panel title="Requests and orders">
        {state.loading ? (
          <LoadingState label="Loading your orders…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No orders yet" message="Anything you request from the marketplace appears here." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {state.data?.items.map((order) => (
              <li key={order.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {order.primaryImageUrl ? (
                        <Image src={order.primaryImageUrl} alt="" fill className="object-cover" sizes="80px" unoptimized />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-umber">{order.listingTitle}</p>
                      <p className="text-xs text-slate-500">
                        {order.orderNumber} · {order.provider.name} · {transactionLabel(order.transactionType)}
                        {order.listingType ? ` · ${listingTypeLabel(order.listingType)}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {order.quantity} × {formatMoney(order.unitPrice, order.currency)} ={" "}
                        <span className="font-semibold">{formatMoney(order.totalAmount, order.currency)}</span>
                        <span className="ml-2 text-xs text-slate-500">Cash · {order.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</span>
                      </p>
                      {order.requestedStartDate ? (
                        <p className="text-xs text-slate-500">
                          From {formatDate(order.requestedStartDate)}
                          {order.requestedEndDate ? ` to ${formatDate(order.requestedEndDate)}` : ""}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">Requested {formatDateTime(order.createdAt)}</p>
                      {nextStep(order) ? <p className="mt-2 text-xs text-slate-600">{nextStep(order)}</p> : null}
                      {order.declineReason ? (
                        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          Provider&apos;s note: {order.declineReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge label={orderProgressLabel(order)} tone={orderStatusTone(order.status)} />
                    {order.status === "REQUESTED" ? (
                      <MutationButton
                        variant="danger-link"
                        pendingLabel="Withdrawing…"
                        confirm={{
                          title: "Withdraw this request?",
                          description: "The provider will no longer see it. You can request again at any time.",
                          confirmLabel: "Withdraw request",
                          variant: "danger",
                        }}
                        action={() => cancelMyMarketplaceOrder(order.id)}
                        successToast="Request withdrawn"
                        onSuccess={() => state.reload()}
                      >
                        Withdraw
                      </MutationButton>
                    ) : order.status === "ACCEPTED" || order.status === "ACTIVE" ? (
                      <span className="text-right text-xs text-slate-400">
                        Need to change this?
                        <br />
                        Contact the provider or Nonnis.
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
