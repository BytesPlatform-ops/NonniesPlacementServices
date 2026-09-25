"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  approveInvoice,
  cancelInvoice,
  getInvoice,
  invoicePdfUrl,
  sendInvoice,
  submitInvoiceForReview,
  verifyInvoicePayment,
} from "@/services/invoices.service";
import { InvoiceLines } from "./InvoiceLines";
import { formatInvoiceMoney, invoiceNextStep, invoiceStatusLabel, invoiceStatusTone, paymentMethodLabel } from "./invoice-status";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * One invoice, and the actions its current state allows.
 *
 * Actions are shown by STATE, not by role alone, so the workflow reads the same
 * way it enforces: a draft can be submitted, a reviewed invoice approved, an
 * approved one sent. The server refuses anything else regardless of what is on
 * screen — the buttons here are convenience, never the control.
 */
export function AdminInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const { hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getInvoice(invoiceId), [invoiceId]);
  const [verifying, setVerifying] = useState(false);

  const canManage = hasPermission(PERMISSIONS.INVOICES_MANAGE);
  const canApprove = hasPermission(PERMISSIONS.INVOICES_APPROVE);
  const canVerify = hasPermission(PERMISSIONS.INVOICES_VERIFY_PAYMENT);

  if (loading && !data) return <LoadingState label="Loading invoice…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const inv = data;

  const back = (
    <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> Invoices
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeading
        title={inv.invoiceNumber}
        description={`${inv.provider.name} · ${formatInvoiceMoney(inv.totalAmount, inv.currency)}`}
        breadcrumb={back}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={invoicePdfUrl(inv.id, "admin")}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden /> PDF
            </a>
            {canManage && inv.status === "DRAFT" ? (
              <MutationButton variant="secondary" action={() => submitInvoiceForReview(inv.id)} successToast="Submitted for approval" onSuccess={reload}>
                Submit for approval
              </MutationButton>
            ) : null}
            {canApprove && (inv.status === "DRAFT" || inv.status === "PENDING_REVIEW") ? (
              <MutationButton
                variant="primary"
                action={() => approveInvoice(inv.id)}
                confirm={{
                  title: "Approve this amount?",
                  description: `You are approving ${formatInvoiceMoney(inv.totalAmount, inv.currency)} for ${inv.provider.name}. Your name is recorded against it.`,
                  confirmLabel: "Approve",
                }}
                successToast="Invoice approved"
                onSuccess={reload}
              >
                Approve
              </MutationButton>
            ) : null}
            {canManage && inv.status === "APPROVED" ? (
              <MutationButton
                variant="primary"
                action={() => sendInvoice(inv.id)}
                confirm={{ title: "Send to provider?", description: `${inv.provider.name} will be able to view and pay this invoice.`, confirmLabel: "Send" }}
                successToast="Invoice sent"
                onSuccess={reload}
              >
                Send to provider
              </MutationButton>
            ) : null}
            {canVerify && inv.status !== "PAID" && inv.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={() => setVerifying(true)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Verify payment
              </button>
            ) : null}
            {canManage && inv.status !== "PAID" && inv.status !== "CANCELLED" ? (
              <MutationButton
                variant="danger-link"
                action={() => cancelInvoice(inv.id)}
                confirm={{ title: "Cancel this invoice?", description: "It will no longer be payable. Payment history is kept.", confirmLabel: "Cancel invoice", variant: "danger" }}
                successToast="Invoice cancelled"
                onSuccess={reload}
              >
                Cancel
              </MutationButton>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={invoiceStatusLabel(inv.status)} tone={invoiceStatusTone(inv.status)} />
        {invoiceNextStep(inv.status) ? <span className="text-sm text-slate-600">{invoiceNextStep(inv.status)}</span> : null}
      </div>

      <Panel title="Details">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Provider</dt>
            <dd className="mt-0.5 text-slate-700">{inv.provider.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Billing</dt>
            <dd className="mt-0.5 text-slate-700">
              {inv.billingType === "RECURRING" ? `Monthly × ${inv.recurringPeriods ?? "—"}` : "One-time"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Payment method</dt>
            <dd className="mt-0.5 text-slate-700">{paymentMethodLabel(inv.paymentMethod)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Issued</dt>
            <dd className="mt-0.5 text-slate-700">{formatDate(inv.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Due</dt>
            <dd className="mt-0.5 text-slate-700">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Amount due</dt>
            <dd className="mt-0.5 font-medium text-umber tabular-nums">{formatInvoiceMoney(inv.amountDue, inv.currency)}</dd>
          </div>
        </dl>
        {inv.notes ? <p className="mt-3 rounded-md bg-ivory px-3 py-2 text-sm text-slate-700">{inv.notes}</p> : null}
      </Panel>

      <Panel title="Line items">
        <InvoiceLines invoice={inv} />
      </Panel>

      {inv.payments.length ? (
        <Panel title="Payments">
          <ul className="divide-y divide-slate-100 text-sm">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-700">
                  {formatInvoiceMoney(p.amount, inv.currency)} · {paymentMethodLabel(p.method)}
                  {p.reference ? <span className="text-slate-400"> · ref {p.reference}</span> : null}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDateTime(p.paidAt)} · {p.verified ? "verified by a person" : "recorded automatically"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="History" description="Every status change on this invoice.">
        <ul className="divide-y divide-slate-100 text-sm">
          {inv.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="text-slate-700">{e.message ?? e.type.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-500">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {verifying ? <VerifyModal invoiceId={inv.id} amountDue={inv.amountDue} currency={inv.currency} onClose={() => setVerifying(false)} onDone={reload} /> : null}
    </div>
  );
}

/**
 * Record that offline money actually arrived.
 *
 * The amount defaults to what is outstanding but stays editable, because a
 * partial payment is a real thing and forcing the full figure would make
 * somebody record money that did not arrive.
 */
function VerifyModal({
  invoiceId,
  amountDue,
  currency,
  onClose,
  onDone,
}: {
  invoiceId: string;
  amountDue: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(amountDue);
  const [method, setMethod] = useState("ZELLE");
  const [reference, setReference] = useState("");

  return (
    <Modal title="Verify payment" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Confirm only what you can see in the bank. This is what marks the invoice paid.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Amount received ({currency})</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="ZELLE">Zelle</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600">Reference (optional)</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <MutationButton
          variant="primary"
          action={() => verifyInvoicePayment(invoiceId, { amount, method, reference: reference.trim() || undefined })}
          successToast="Payment verified"
          onSuccess={() => {
            onDone();
            onClose();
          }}
        >
          Verify payment
        </MutationButton>
      </div>
    </Modal>
  );
}
