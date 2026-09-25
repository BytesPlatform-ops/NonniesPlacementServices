"use client";

import type { InvoiceView } from "@/types/invoices";
import { formatInvoiceMoney } from "./invoice-status";

/** The line-item table and totals, shared by the admin and provider views. */
export function InvoiceLines({ invoice }: { invoice: InvoiceView }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sage text-left text-xs text-slate-500">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit price</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 text-slate-700">
                  {item.name}
                  {item.description ? <span className="block text-xs text-slate-500">{item.description}</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-700">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums text-slate-700">{item.unitPrice}</td>
                <td className="py-2 text-right tabular-nums text-slate-700">{item.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="tabular-nums text-slate-700">{invoice.subtotal}</dd>
        </div>
        {invoice.taxAmount !== "0.00" ? (
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax ({(Number(invoice.taxRate) * 100).toFixed(2)}%)</dt>
            <dd className="tabular-nums text-slate-700">{invoice.taxAmount}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-sage pt-1 text-base font-semibold text-umber">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatInvoiceMoney(invoice.totalAmount, invoice.currency)}</dd>
        </div>
        {invoice.amountPaid !== "0.00" ? (
          <>
            <div className="flex justify-between">
              <dt className="text-slate-500">Paid</dt>
              <dd className="tabular-nums text-slate-700">− {invoice.amountPaid}</dd>
            </div>
            <div className="flex justify-between font-medium text-umber">
              <dt>Amount due</dt>
              <dd className="tabular-nums">{formatInvoiceMoney(invoice.amountDue, invoice.currency)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
