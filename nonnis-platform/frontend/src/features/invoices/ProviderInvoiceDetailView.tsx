"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, CreditCard, Download } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { getMyInvoice, getPaymentOptions, invoicePdfUrl, reportMyInvoicePayment, startMyInvoiceCardPayment } from "@/services/invoices.service";
import { InvoiceLines } from "./InvoiceLines";
import { formatInvoiceMoney, invoiceStatusLabel, invoiceStatusTone, paymentMethodLabel, providerPaymentChoices } from "./invoice-status";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * A provider's view of one invoice.
 *
 * Read-only on every figure. The only thing a provider can do is say they have
 * sent an offline payment, which moves the invoice to awaiting verification —
 * it never settles it, because the money has to be seen before it is recorded.
 */
export function ProviderInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const { data, loading, error, reload } = useAsync(() => getMyInvoice(invoiceId), [invoiceId]);
  const { data: options } = useAsync(() => getPaymentOptions(), []);
  const [reference, setReference] = useState("");
  // Read after mount: the server render has no query string, and guessing one
  // would make the first paint disagree with the browser.
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => setReturned(new URLSearchParams(window.location.search).get("payment")), []);

  if (loading && !data) return <LoadingState label="Loading invoice…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const inv = data;

  const payable = ["SENT", "PENDING_PAYMENT", "OVERDUE", "REQUIRES_VERIFICATION"].includes(inv.status);
  // Both ways of paying are offered together, and which to use is the
  // provider's decision — not something Nonni's settled when it raised the
  // invoice. The rule lives in one tested function so `inv.paymentMethod` has
  // no way to reach it.
  const choices = providerPaymentChoices(inv.status, options);

  return (
    <div className="space-y-4">
      <PageHeading
        title={inv.invoiceNumber}
        description={`From Nonni's Placement Services · ${formatInvoiceMoney(inv.totalAmount, inv.currency)}`}
        breadcrumb={
          <Link href="/provider/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Invoices
          </Link>
        }
        actions={
          <a
            href={invoicePdfUrl(inv.id, "provider")}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden /> Download PDF
          </a>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={invoiceStatusLabel(inv.status)} tone={invoiceStatusTone(inv.status)} />
        <span className="text-sm text-slate-600">
          Amount due <span className="font-medium text-umber tabular-nums">{formatInvoiceMoney(inv.amountDue, inv.currency)}</span>
          {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
        </span>
      </div>

      <Panel title="Line items">
        <InvoiceLines invoice={inv} />
        {inv.notes ? <p className="mt-3 rounded-md bg-ivory px-3 py-2 text-sm text-slate-700">{inv.notes}</p> : null}
      </Panel>

      {payable ? (
        <Panel title="Pay this invoice" description="Choose whichever suits you.">
          {returned === "processing" ? (
            <p className="mb-3 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Thanks — your card payment is going through. This invoice will show as paid as soon as the bank confirms it, usually within a
              minute. You do not need to pay again.
            </p>
          ) : null}
          {returned === "cancelled" ? (
            <p className="mb-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              You left the card payment before it finished, so nothing was charged. You can start it again below.
            </p>
          ) : null}

          <div className="space-y-4">
            {choices.card ? (
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-umber">Pay by card</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Your card details are entered on Stripe&apos;s secure page, never here. The invoice is marked paid as soon as the bank
                  confirms it.
                </p>
                <div className="mt-3">
                  <MutationButton
                    variant="primary"
                    pendingLabel="Opening secure page…"
                    action={() => startMyInvoiceCardPayment(inv.id)}
                    onSuccess={(res) => {
                      window.location.href = res.url;
                    }}
                  >
                    <CreditCard className="h-4 w-4" aria-hidden /> Pay {formatInvoiceMoney(inv.amountDue, inv.currency)} by card
                  </MutationButton>
                </div>
              </div>
            ) : choices.cardUnavailableReason ? (
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-umber">Pay by card</p>
                <p className="mt-0.5 text-sm text-slate-600">{choices.cardUnavailableReason}</p>
              </div>
            ) : null}

            {choices.zelle ? (
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-umber">Pay by Zelle</p>
                <div className="mt-2 grid gap-4 sm:grid-cols-[auto,1fr]">
                  {options?.zelleQrUrl ? (
                    <Image
                      src={options.zelleQrUrl}
                      alt={`Zelle QR code for ${options.zelleRecipient}`}
                      width={150}
                      height={195}
                      className="rounded-md border border-slate-200 bg-white"
                      // A QR has to stay crisp; Next's optimizer would resample it.
                      unoptimized
                    />
                  ) : null}
                  <div>
                    <p className="text-sm text-slate-600">
                      Scan with your banking app to send to{" "}
                      <span className="font-medium text-umber">{options?.zelleRecipient ?? "Nonni's Placement Services LLC"}</span>.
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      A Zelle payment is confirmed by hand, so tell us below once you have sent it and Nonni&apos;s will check the account.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {inv.status === "REQUIRES_VERIFICATION" ? (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You have told us this is paid. Nonni&apos;s is checking the account — you do not need to pay again.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block max-w-xs flex-1">
              <span className="text-xs font-medium text-slate-600">Confirmation code (optional)</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Your bank reference" className={inputCls} />
            </label>
            <MutationButton
              variant="primary"
              action={() => reportMyInvoicePayment(inv.id, { reference: reference.trim() || undefined })}
              successToast="Thanks — Nonni's will confirm it"
              onSuccess={reload}
            >
              I&apos;ve sent the payment
            </MutationButton>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            This tells Nonni&apos;s to look out for it. The invoice is marked paid once the money is confirmed.
          </p>
        </Panel>
      ) : null}

      {inv.payments.length ? (
        <Panel title="Payments">
          <ul className="divide-y divide-slate-100 text-sm">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-700">
                  {formatInvoiceMoney(p.amount, inv.currency)} · {paymentMethodLabel(p.method)}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(p.paidAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
