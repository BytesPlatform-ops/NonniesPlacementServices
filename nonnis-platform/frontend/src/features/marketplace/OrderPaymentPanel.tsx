"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Clock, CreditCard, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { formatDateTime } from "@/lib/format";
import { reportMyMarketplacePayment, startMarketplaceCardPayment } from "@/services/marketplace.service";
import type { MarketplaceOrder } from "@/types/marketplace";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Card is listed first because it is the only one that settles by itself; the
 * other two are offline routes someone has to confirm by hand afterwards.
 */
const METHODS = [
  { value: "STRIPE" as const, label: "Card" },
  { value: "ZELLE" as const, label: "Zelle" },
  { value: "CASH" as const, label: "Cash / in person" },
];

/**
 * How a family pays for an accepted order, and tells us they have.
 *
 * Reporting a payment is deliberately NOT the same as the order being paid.
 * Zelle money reaches Nonni's, so only someone who can see that account may
 * confirm it; this panel records what the family did and shows them plainly
 * that confirmation is still pending. Saying otherwise would let an order look
 * settled to the person who owes the money and unsettled to everyone else.
 */
export function OrderPaymentPanel({ order, onReported }: { order: MarketplaceOrder; onReported: () => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<"STRIPE" | "ZELLE" | "CASH">("STRIPE");
  const [redirecting, setRedirecting] = useState(false);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const settled = order.paymentStatus === "PAID";
  const reported = !!order.paymentReportedAt;
  const payable = (order.status === "ACCEPTED" || order.status === "ACTIVE") && !settled;

  /**
   * Hand the browser to Stripe Checkout.
   *
   * Nothing about the order changes here beyond recording which session it
   * belongs to — returning from Stripe proves nothing, and only the webhook
   * marks it paid.
   */
  const payByCard = async () => {
    setRedirecting(true);
    try {
      const { url } = await startMarketplaceCardPayment(order.id);
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not open the card payment page.");
      setRedirecting(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      // Only the offline routes can be *reported*: a card payment is settled by
      // Stripe's webhook, never by the payer saying so.
      if (method === "STRIPE") return;
      await reportMyMarketplacePayment(order.id, { method, reference: reference.trim() || undefined });
      toast.success("Thanks — the provider has been told to look out for it");
      setReference("");
      onReported();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not record your payment.");
    } finally {
      setSaving(false);
    }
  };

  if (settled) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Payment confirmed{order.paidAt ? ` on ${formatDateTime(order.paidAt)}` : ""}. Nothing further is needed.
        </span>
      </div>
    );
  }

  if (!payable) return null;

  return (
    <div className="rounded-lg border border-sage bg-white p-4">
      <h3 className="text-sm font-semibold text-umber">Pay for this order</h3>
      <p className="mt-0.5 text-sm text-slate-600">
        Total due <span className="font-medium text-umber">${order.totalAmount}</span> {order.currency}.
      </p>

      {reported ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            You reported this payment on {formatDateTime(order.paymentReportedAt)}
            {order.paymentReference ? ` (reference ${order.paymentReference})` : ""}. It is waiting to be confirmed — you do not need to pay
            again. If something was wrong, you can report it again below.
          </span>
        </div>
      ) : null}

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-slate-600">Payment method</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                method === m.value ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="payment-method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {method === "STRIPE" ? (
        <div className="mt-4">
          <p className="text-sm text-slate-600">
            You will be taken to Stripe to pay securely by card. Nonni&apos;s never sees or stores your card details.
          </p>
          <button
            type="button"
            onClick={() => void payByCard()}
            disabled={redirecting}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {redirecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
            {redirecting ? "Opening Stripe…" : `Pay $${order.totalAmount} with card`}
          </button>
          <p className="mt-1.5 text-xs text-slate-400">
            Your order is marked paid once Stripe confirms the payment — usually within a few seconds of finishing.
          </p>
        </div>
      ) : (
      <div className="mt-4 grid gap-5 sm:grid-cols-[auto,1fr]">
        <div className="mx-auto sm:mx-0">
          <Image
            src="/51094.jpg"
            alt="Zelle QR code for Nonni's Placement Services LLC"
            width={200}
            height={260}
            className="rounded-md border border-sage bg-white"
            // A QR code has to stay crisp; Next's optimizer would resample it.
            unoptimized
          />
          <p className="mt-1.5 max-w-[200px] text-center text-xs text-slate-500 sm:text-left">
            Scan with your banking app to send to <span className="font-medium text-slate-600">Nonni&apos;s Placement Services LLC</span>.
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-600">
            Once you have sent the money, tell us here. The provider is notified straight away and confirms it when it arrives.
          </p>

          <label className="mt-3 block max-w-sm">
            <span className="text-xs font-medium text-slate-600">Confirmation code (optional)</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="The reference your bank shows"
              maxLength={120}
              className={inputCls}
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : reported ? "Update my payment report" : "I've sent the payment"}
          </button>
          <p className="mt-1.5 text-xs text-slate-400">
            This tells the provider you have paid. The order is marked paid once they confirm the money arrived.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
