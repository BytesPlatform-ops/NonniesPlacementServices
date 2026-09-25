"use client";

import Image from "next/image";
import { OrderPaymentPanel } from "./OrderPaymentPanel";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
    // A card payment settles itself, so the instruction differs from the offline
    // routes, which need the family to tell us they have sent the money.
    if (order.paymentMethod === "STRIPE") {
      return order.stripePaymentStatus === "paid"
        ? "Your card payment is being confirmed."
        : "The provider accepted. Pay by card below, or choose another method.";
    }
    return order.paymentReportedAt
      ? "You reported your payment. Waiting for it to be confirmed."
      : "The provider accepted. Pay below, then tell us you have sent it.";
  }
  if (order.status === "ACCEPTED" && order.paymentStatus === "PAID") return "Payment received. The provider will confirm the rest.";
  if (order.status === "ACTIVE") return "Your rental is active.";
  if (order.status === "COMPLETED") return "This order is complete.";
  if (order.status === "DECLINED") return "The provider could not take this one.";
  return null;
}

export function SeekerOrdersView() {
  const state = useAsync(() => listMyMarketplaceOrders({ page: 1 }), []);

  // Coming back from Stripe Checkout. The URL says what the BROWSER did, never
  // what was paid — Stripe's webhook decides that, and it may land a moment
  // after the redirect, so this reloads once rather than asserting anything.
  const params = useSearchParams();
  const outcome = params.get("payment");
  useEffect(() => {
    if (outcome !== "processing") return;
    const t = setTimeout(() => state.reload(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="My orders"
        description="Your marketplace requests and their payments."
        actions={
          <Link href="/seeker/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
            Browse the marketplace
          </Link>
        }
      />

      {outcome === "processing" ? (
        <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
          Thanks — your card payment is being confirmed. This page updates on its own; it usually takes a few seconds.
        </div>
      ) : null}
      {outcome === "cancelled" ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Card payment was cancelled. Nothing has been charged — you can try again below or choose another method.
        </div>
      ) : null}
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
                        <span className="ml-2 text-xs text-slate-500">
                          {order.paymentMethod === "STRIPE" ? "Card" : order.paymentMethod === "ZELLE" ? "Zelle" : "Cash"} ·{" "}
                          {order.paymentStatus === "PAID" ? "Paid" : order.paymentReportedAt ? "Awaiting confirmation" : "Unpaid"}
                        </span>
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
                <div className="mt-3">
                  <OrderPaymentPanel order={order} onReported={() => state.reload()} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
