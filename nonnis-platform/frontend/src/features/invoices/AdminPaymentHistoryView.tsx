"use client";

import { useState } from "react";
import Link from "next/link";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { listPaymentHistory } from "@/services/invoices.service";
import type { PaymentHistoryRow } from "@/types/invoices";
import { formatInvoiceMoney, paymentMethodLabel } from "./invoice-status";

const STATUSES = ["ALL", "PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED", "CANCELLED", "REQUIRES_VERIFICATION"] as const;

const TONE: Record<string, "positive" | "negative" | "warning" | "progress" | "neutral"> = {
  SUCCEEDED: "positive",
  PENDING: "warning",
  PROCESSING: "progress",
  REQUIRES_VERIFICATION: "warning",
  FAILED: "negative",
  REFUNDED: "neutral",
  CANCELLED: "neutral",
};

function label(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/**
 * Every payment record, across providers and invoices.
 *
 * Its own view rather than a column on the invoice list, because payment
 * history outlives an invoice's current status: a failed attempt and a later
 * refund both stay here, and an invoice since cancelled still has to account
 * for money that moved.
 */
export function AdminPaymentHistoryView() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const { data, loading, error, reload } = useAsync(
    () => listPaymentHistory({ status: status === "ALL" ? undefined : status }),
    [status],
  );

  const columns: Column<PaymentHistoryRow>[] = [
    { key: "provider", header: "Provider", render: (p) => p.provider.name },
    {
      key: "invoice",
      header: "Invoice",
      render: (p) => (
        <Link href={`/admin/invoices/${p.invoiceId}`} className="font-medium text-brand-800 hover:underline">
          {p.invoiceNumber}
        </Link>
      ),
    },
    { key: "amount", header: "Amount", align: "right", render: (p) => <span className="tabular-nums">{formatInvoiceMoney(p.amount, p.currency)}</span> },
    { key: "method", header: "Method", render: (p) => paymentMethodLabel(p.method) },
    { key: "status", header: "Status", render: (p) => <StatusBadge label={label(p.status)} tone={TONE[p.status] ?? "neutral"} /> },
    { key: "paidAt", header: "Payment date", render: (p) => formatDateTime(p.paidAt) },
    { key: "reference", header: "Reference", render: (p) => p.reference ?? "—" },
    { key: "verified", header: "Verified by", render: (p) => (p.verified ? "A person" : "Automatically") },
    { key: "created", header: "Created", render: (p) => formatDateTime(p.createdAt) },
    { key: "updated", header: "Updated", render: (p) => formatDateTime(p.updatedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Payment history" description="Every payment recorded against a provider invoice. Records are never removed or rewritten." />

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${status === s ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-sage/40"}`}
          >
            {s === "ALL" ? "All" : label(s)}
          </button>
        ))}
      </div>

      <Panel title="Payments" description={data ? `${data.total} record${data.total === 1 ? "" : "s"}` : undefined}>
        {loading && !data ? (
          <LoadingState label="Loading payments…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No payments" message="Payments appear here once money is recorded against an invoice." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(p) => p.id} />
        )}
      </Panel>
    </div>
  );
}
