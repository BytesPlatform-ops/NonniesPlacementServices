"use client";

import Link from "next/link";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { listMyInvoices } from "@/services/invoices.service";
import type { InvoiceView } from "@/types/invoices";
import { formatInvoiceMoney, invoiceStatusLabel, invoiceStatusTone, paymentMethodLabel } from "./invoice-status";

/** A provider's own billing. Read and pay only — amounts are never editable here. */
export function ProviderInvoicesView() {
  const { data, loading, error, reload } = useAsync(() => listMyInvoices({ page: 1 }), []);

  const columns: Column<InvoiceView>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (i) => (
        <Link href={`/provider/invoices/${i.id}`} className="font-medium text-brand-800 hover:underline">
          {i.invoiceNumber}
        </Link>
      ),
    },
    { key: "amount", header: "Amount", align: "right", render: (i) => <span className="tabular-nums">{formatInvoiceMoney(i.totalAmount, i.currency)}</span> },
    { key: "due", header: "Amount due", align: "right", render: (i) => <span className="tabular-nums">{formatInvoiceMoney(i.amountDue, i.currency)}</span> },
    { key: "method", header: "Method", render: (i) => paymentMethodLabel(i.paymentMethod) },
    { key: "status", header: "Status", render: (i) => <StatusBadge label={invoiceStatusLabel(i.status)} tone={invoiceStatusTone(i.status)} /> },
    { key: "dueDate", header: "Due", render: (i) => (i.dueDate ? formatDate(i.dueDate) : "—") },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Invoices" description="Billing from Nonni's Placement Services." />
      <Panel title="Your invoices">
        {loading && !data ? (
          <LoadingState label="Loading invoices…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No invoices yet" message="Invoices from Nonni's will appear here." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(i) => i.id} />
        )}
      </Panel>
    </div>
  );
}
