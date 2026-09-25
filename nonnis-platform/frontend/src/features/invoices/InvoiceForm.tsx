"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { listProviders } from "@/services/providers.service";
import { createInvoice, listProducts } from "@/services/invoices.service";
import type { InvoiceItemInput } from "@/types/invoices";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

interface DraftLine extends InvoiceItemInput {
  key: string;
}

function blankLine(): DraftLine {
  return { key: crypto.randomUUID(), name: "", quantity: "1", unitPrice: "" };
}

/**
 * Money arithmetic for the live preview only.
 *
 * Deliberately a mirror of the server's rule — round each line to cents, then
 * sum — so the figure someone sees while typing is the figure that gets stored.
 * The server recomputes all of it from the items and is the only authority; if
 * these ever disagree, the server wins and this is the bug.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function previewTotals(lines: DraftLine[], taxRate: string) {
  const lineTotals = lines.map((l) => {
    const q = Number.parseFloat(l.quantity);
    const p = Number.parseFloat(l.unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? round2(q * p) : 0;
  });
  const subtotal = round2(lineTotals.reduce((a, b) => a + b, 0));
  const rate = Number.parseFloat(taxRate);
  const taxAmount = Number.isFinite(rate) ? round2(subtotal * rate) : 0;
  return { lineTotals, subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}

const money = (n: number) => n.toFixed(2);

/**
 * Write an invoice for one provider.
 *
 * The product a line names is only the KIND of charge. Its suggested price is
 * offered as a starting figure and can be overwritten, because placement fees
 * are whatever the signed agreement says and the subscription price is not
 * settled. Whatever is typed here is still a draft: nothing reaches a provider
 * until an authorized admin approves the amount.
 */
export function InvoiceForm() {
  const router = useRouter();
  const toast = useToast();
  // Only providers Nonni's is actually trading with can be billed: a paused or
  // closed provider is not paying a monthly subscription, and putting one in the
  // picker only invites an invoice nobody will settle.
  //
  // 100 is the API's maximum page size. Asking for more is rejected outright,
  // which is how this list came back empty rather than long.
  const providers = useAsync(() => listProviders({ page: 1, pageSize: 100, status: "ACTIVE" }), []);
  const products = useAsync(() => listProducts(true), []);

  const [providerId, setProviderId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState("");
  // Card by default, because it is the only method that settles itself. This is
  // Nonni's own expectation, not a restriction: the provider is shown both ways
  // to pay when the invoice reaches them, whatever is chosen here.
  const [paymentMethod, setPaymentMethod] = useState("STRIPE");
  const [billingType, setBillingType] = useState<"ONE_TIME" | "RECURRING">("ONE_TIME");
  const [recurringPeriods, setRecurringPeriods] = useState("2");
  const [recurringStartAt, setRecurringStartAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => previewTotals(lines, taxRate), [lines, taxRate]);

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Choosing a product names the line and offers its suggested figure. */
  const applyProduct = (key: string, productId: string) => {
    const product = (products.data ?? []).find((p) => p.id === productId);
    if (!product) {
      setLine(key, { productId: undefined });
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? {
              ...l,
              productId: product.id,
              name: l.name.trim() || product.name,
              // Only ever a starting point, and only when nothing was typed.
              unitPrice: l.unitPrice.trim() || product.suggestedUnitPrice || "",
            }
          : l,
      ),
    );
  };

  const valid =
    !!providerId &&
    lines.length > 0 &&
    lines.every((l) => l.name.trim() && Number.isFinite(Number.parseFloat(l.quantity)) && Number.isFinite(Number.parseFloat(l.unitPrice)));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const created = await createInvoice({
        providerId,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name.trim(),
          description: l.description?.trim() || undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        taxRate: taxRate || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        paymentMethod,
        billingType,
        ...(billingType === "RECURRING"
          ? {
              recurringInterval: "MONTHLY",
              recurringPeriods: Number.parseInt(recurringPeriods, 10) || 1,
              recurringStartAt: recurringStartAt ? new Date(recurringStartAt).toISOString() : undefined,
            }
          : {}),
        notes: notes.trim() || undefined,
      });
      toast.success(`Draft ${created.invoiceNumber} created`);
      router.push(`/admin/invoices/${created.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create the invoice.");
      setBusy(false);
    }
  };

  if (providers.loading || products.loading) return <LoadingState label="Loading…" />;
  // Without these two lists there is nothing to bill and nothing to bill for, so
  // say what went wrong rather than showing an empty picker and no reason.
  const loadError = providers.error ?? products.error;
  if (loadError) {
    return (
      <ErrorState
        message={loadError.message}
        onRetry={() => {
          providers.reload();
          products.reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeading title="New invoice" description="Saved as a draft. Nothing reaches the provider until the amount is approved." />

      <Panel title="Provider">
        <label className="block max-w-md">
          <span className="text-xs font-medium text-slate-600">Bill to</span>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Select a provider…</option>
            {(providers.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      <Panel title="Line items" description="The product is the kind of charge. The amount is whatever you agree with this provider.">
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={line.key} className="rounded-md border border-slate-200 p-3">
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="sm:col-span-4">
                  <span className="text-xs font-medium text-slate-600">Product</span>
                  <select value={line.productId ?? ""} onChange={(e) => applyProduct(line.key, e.target.value)} className={`${inputCls} bg-white`}>
                    <option value="">Custom charge</option>
                    {(products.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-4">
                  <span className="text-xs font-medium text-slate-600">Description on the invoice</span>
                  <input value={line.name} onChange={(e) => setLine(line.key, { name: e.target.value })} className={inputCls} />
                </label>
                <label className="sm:col-span-1">
                  <span className="text-xs font-medium text-slate-600">Qty</span>
                  <input value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} inputMode="decimal" className={inputCls} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600">Unit price</span>
                  <input value={line.unitPrice} onChange={(e) => setLine(line.key, { unitPrice: e.target.value })} inputMode="decimal" placeholder="0.00" className={inputCls} />
                </label>
                <div className="flex items-end justify-between gap-2 sm:col-span-1">
                  <span className="text-sm font-medium text-umber tabular-nums">{money(totals.lineTotals[i] ?? 0)}</span>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove line ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, blankLine()])}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-brand-700 hover:border-brand-400 hover:bg-ivory"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add line item
        </button>

        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="tabular-nums text-slate-700">{money(totals.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">
              Tax rate
              <input
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                inputMode="decimal"
                className="ml-2 w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                aria-label="Tax rate as a fraction, for example 0.0825"
              />
            </dt>
            <dd className="tabular-nums text-slate-700">{money(totals.taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-sage pt-1 text-base font-semibold text-umber">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.total)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-right text-xs text-slate-400">Tax rate is a fraction — 0.0825 is 8.25%.</p>
      </Panel>

      <Panel title="Billing">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select value={billingType} onChange={(e) => setBillingType(e.target.value as "ONE_TIME" | "RECURRING")} className={`${inputCls} bg-white`}>
              <option value="ONE_TIME">One-time</option>
              <option value="RECURRING">Recurring monthly</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Payment method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="STRIPE">Card</option>
              <option value="ZELLE">Zelle</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </label>
          {billingType === "RECURRING" ? (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Number of months</span>
                <input value={recurringPeriods} onChange={(e) => setRecurringPeriods(e.target.value)} inputMode="numeric" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">First charge</span>
                <input type="date" value={recurringStartAt} onChange={(e) => setRecurringStartAt(e.target.value)} className={inputCls} />
              </label>
            </>
          ) : null}
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">Notes on the invoice</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
        </label>
      </Panel>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/admin/invoices")} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || busy}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save draft"}
        </button>
      </div>
    </div>
  );
}
