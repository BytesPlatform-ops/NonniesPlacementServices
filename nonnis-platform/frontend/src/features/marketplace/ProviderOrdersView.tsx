"use client";

import Image from "next/image";
import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney, listingTypeLabel, orderProgressLabel, orderStatusTone, transactionLabel } from "@/lib/marketplace";
import {
  acceptOrder,
  cancelAcceptedOrder,
  completeOrder,
  declineOrder,
  listProviderOrders,
  recordCashPayment,
  startRental,
} from "@/services/marketplace.service";
import type { MarketplaceOrder } from "@/types/marketplace";

const rate = (o: MarketplaceOrder) =>
  o.billingPeriod ? ` (${formatMoney(o.unitPrice, o.currency)} per unit, per ${o.billingPeriod.toLowerCase().replace("ly", "")})` : "";

function OrderCard({ order, onChanged }: { order: MarketplaceOrder; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const pending = order.status === "REQUESTED";
  const awaitingCash = order.status === "ACCEPTED" && order.paymentStatus === "UNPAID";
  const paid = order.paymentStatus === "PAID";

  return (
    <li className="py-4 first:pt-0 last:pb-0">
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
              {order.orderNumber} · {transactionLabel(order.transactionType)}
              {order.listingType ? ` · ${listingTypeLabel(order.listingType)}` : ""} · {formatDateTime(order.createdAt)}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {order.quantity} × {formatMoney(order.unitPrice, order.currency)} ={" "}
              <span className="font-semibold">{formatMoney(order.totalAmount, order.currency)}</span>
              {rate(order)}
            </p>
            {order.requestedStartDate ? (
              <p className="text-xs text-slate-500">
                Requested from {formatDate(order.requestedStartDate)}
                {order.requestedEndDate ? ` to ${formatDate(order.requestedEndDate)}` : ""}
              </p>
            ) : null}
            {order.seekerNote ? (
              <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">{order.seekerNote}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge label={orderProgressLabel(order)} tone={orderStatusTone(order.status)} />
          <span className="text-xs text-slate-500">Cash · {paid ? "Paid" : "Unpaid"}</span>
        </div>
      </div>

      {pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <MutationButton
            variant="primary"
            pendingLabel="Accepting…"
            confirm={{
              title: "Accept this request?",
              description: `${order.quantity} will be taken from this listing's availability. Cash is collected offline after you accept.`,
              confirmLabel: "Accept request",
            }}
            action={() => acceptOrder(order.id)}
            successToast="Request accepted"
            onSuccess={onChanged}
          >
            Accept
          </MutationButton>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-48 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <MutationButton
            variant="danger-link"
            pendingLabel="Declining…"
            confirm={{ title: "Decline this request?", description: "The family will see that you could not take it. No availability is used.", confirmLabel: "Decline", variant: "danger" }}
            action={() => declineOrder(order.id, reason.trim() || undefined)}
            successToast="Request declined"
            onSuccess={onChanged}
          >
            Decline
          </MutationButton>
        </div>
      ) : null}

      {awaitingCash ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <MutationButton
            variant="primary"
            pendingLabel="Recording…"
            confirm={{
              title: "Record the cash payment?",
              description: `Confirms ${formatMoney(order.totalAmount, order.currency)} was received for ${order.orderNumber}.`,
              confirmLabel: "Mark cash received",
            }}
            action={() => recordCashPayment(order.id)}
            successToast="Payment recorded"
            onSuccess={onChanged}
          >
            Mark cash received
          </MutationButton>
          <MutationButton
            variant="danger-link"
            pendingLabel="Cancelling…"
            confirm={{
              title: "Cancel this order?",
              description: "The availability you reserved goes back to the listing. Only possible before payment.",
              confirmLabel: "Cancel order",
              variant: "danger",
            }}
            action={() => cancelAcceptedOrder(order.id, reason.trim() || undefined)}
            successToast="Order cancelled and availability restored"
            onSuccess={onChanged}
          >
            Cancel
          </MutationButton>
        </div>
      ) : null}

      {paid && order.status === "ACCEPTED" && order.transactionType === "RENT" ? (
        <div className="mt-3">
          <MutationButton
            variant="secondary"
            pendingLabel="Starting…"
            action={() => startRental(order.id)}
            successToast="Rental started"
            onSuccess={onChanged}
          >
            Start rental
          </MutationButton>
        </div>
      ) : null}

      {paid && (order.status === "ACCEPTED" || order.status === "ACTIVE") ? (
        <div className="mt-3">
          <MutationButton
            variant="secondary"
            pendingLabel="Completing…"
            confirm={{ title: "Mark this order complete?", description: "Use this once the sale or rental has been fulfilled.", confirmLabel: "Complete" }}
            action={() => completeOrder(order.id)}
            successToast="Order completed"
            onSuccess={onChanged}
          >
            Mark complete
          </MutationButton>
        </div>
      ) : null}

      {order.declineReason ? <p className="mt-2 text-xs text-slate-500">Reason: {order.declineReason}</p> : null}
    </li>
  );
}

export function ProviderOrdersView() {
  const state = useAsync(() => listProviderOrders({ page: 1 }), []);
  const orders = state.data?.items ?? [];
  const pending = orders.filter((o) => o.status === "REQUESTED");
  const rest = orders.filter((o) => o.status !== "REQUESTED");

  return (
    <div className="space-y-6">
      <PageHeading
        title="Marketplace orders"
        description="Requests from families to buy or rent your listings. Payment is collected offline in cash."
      />
      {state.loading ? (
        <Panel><LoadingState label="Loading orders…" /></Panel>
      ) : state.error ? (
        <Panel><ErrorState message={state.error.message} onRetry={state.reload} /></Panel>
      ) : orders.length === 0 ? (
        <Panel><EmptyState title="No orders yet" message="Requests appear here once a family asks to buy or rent one of your listings." /></Panel>
      ) : (
        <>
          <Panel title={`Needs your answer (${pending.length})`}>
            {pending.length === 0 ? (
              <EmptyState title="Nothing waiting" message="Every request has been answered." />
            ) : (
              <ul className="divide-y divide-sage/70">
                {pending.map((o) => (
                  <OrderCard key={o.id} order={o} onChanged={() => state.reload()} />
                ))}
              </ul>
            )}
          </Panel>
          {rest.length > 0 ? (
            <Panel title="Answered">
              <ul className="divide-y divide-sage/70">
                {rest.map((o) => (
                  <OrderCard key={o.id} order={o} onChanged={() => state.reload()} />
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
