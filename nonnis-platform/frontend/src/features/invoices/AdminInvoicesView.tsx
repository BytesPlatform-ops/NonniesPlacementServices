"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { listInvoices } from "@/services/invoices.service";
import type { InvoiceStatus, InvoiceView } from "@/types/invoices";
import { formatInvoiceMoney, invoiceStatusLabel, invoiceStatusTone, paymentMethodLabel } from "./invoice-status";

const FILTERS: Array<{ key: InvoiceStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PENDING_REVIEW", label: "Awaiting approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "SENT", label: "Sent" },
  { key: "REQUIRES_VERIFICATION", label: "To verify" },
  { key: "PAID", label: "Paid" },
  { key: "OVERDUE", label: "Overdue" },
];

export function AdminInvoicesView() {
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const { data, loading, error, reload } = useAsync(
    () => listInvoices({ status: status === "ALL" ? undefined : status, pageSize: 100 }),
    [status],
  );

  const columns: Column<InvoiceView>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (i) => (
        <Link href={`/admin/invoices/${i.id}`} className="font-medium text-brand-800 hover:underline">
          {i.invoiceNumber}
        </Link>
      ),
    },
    { key: "provider", header: "Provider", render: (i) => i.provider.name },
    { key: "amount", header: "Amount", align: "right", render: (i) => <span className="tabular-nums">{formatInvoiceMoney(i.totalAmount, i.currency)}</span> },
    { key: "method", header: "Method", render: (i) => paymentMethodLabel(i.paymentMethod) },
    { key: "status", header: "Status", render: (i) => <StatusBadge label={invoiceStatusLabel(i.status)} tone={invoiceStatusTone(i.status)} /> },
    { key: "issue", header: "Issued", render: (i) => formatDate(i.issueDate) },
    { key: "due", header: "Due", render: (i) => (i.dueDate ? formatDate(i.dueDate) : "—") },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Invoices"
        description="Billing issued to providers. An invoice reaches a provider only once its amount is approved."
        actions={
          <Link
            href="/admin/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> New invoice
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${status === f.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-sage/40"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel title="Invoices" description={data ? `${data.total} invoice${data.total === 1 ? "" : "s"}` : undefined}>
        {loading && !data ? (
          <LoadingState label="Loading invoices…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No invoices" message="Create one to bill a provider for a placement or their subscription." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(i) => i.id} />
        )}
      </Panel>
    </div>
  );
}
