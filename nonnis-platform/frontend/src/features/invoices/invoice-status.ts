import type { StatusTone } from "@/lib/case-status";
import type { InvoiceStatus } from "@/types/invoices";

const LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  SENT: "Sent",
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REQUIRES_VERIFICATION: "Awaiting verification",
};

const TONES: Record<InvoiceStatus, StatusTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "progress",
  APPROVED: "progress",
  SENT: "progress",
  PENDING_PAYMENT: "warning",
  PAID: "positive",
  OVERDUE: "negative",
  CANCELLED: "neutral",
  REQUIRES_VERIFICATION: "warning",
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return LABELS[status] ?? status;
}

export function invoiceStatusTone(status: InvoiceStatus): StatusTone {
  return TONES[status] ?? "neutral";
}

export function paymentMethodLabel(method: string): string {
  if (method === "STRIPE") return "Card";
  if (method === "BANK_TRANSFER") return "Bank transfer";
  return method.charAt(0) + method.slice(1).toLowerCase();
}

/** Money for display. The value is already a fixed-2 string from the API. */
export function formatInvoiceMoney(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

/**
 * What a reader is waiting for next.
 *
 * Written from the invoice's own state rather than a stored field, so it can
 * never drift from the status beside it.
 */
export function invoiceNextStep(status: InvoiceStatus): string | null {
  switch (status) {
    case "DRAFT":
      return "Finish the line items, then submit it for approval.";
    case "PENDING_REVIEW":
      return "Waiting for an authorized admin to approve the amount.";
    case "APPROVED":
      return "Approved. Ready to send to the provider.";
    case "SENT":
    case "PENDING_PAYMENT":
      return "Waiting for payment.";
    case "REQUIRES_VERIFICATION":
      return "The provider says they have paid. Check the bank, then verify it.";
    case "OVERDUE":
      return "Past its due date and still unpaid.";
    default:
      return null;
  }
}

/** What the provider's screen may offer for one invoice. */
export interface ProviderPaymentChoices {
  card: boolean;
  cardUnavailableReason: string | null;
  zelle: boolean;
}

/**
 * Which ways of paying to put in front of a provider.
 *
 * Deliberately a function of the invoice's STATUS and the gateway's state, and
 * nothing else. In particular it is not a function of `invoice.paymentMethod`:
 * that field is Nonni's own expectation when the bill was raised, and the
 * provider decides how to pay once it arrives. Passing it in here is the bug
 * this function exists to prevent.
 */
export function providerPaymentChoices(
  status: string,
  options: { card: boolean; cardUnavailableReason: string | null; zelle: boolean } | null | undefined,
): ProviderPaymentChoices {
  // A settled or withdrawn bill is not payable by any route.
  const open = ["SENT", "PENDING_PAYMENT", "OVERDUE"].includes(status);
  return {
    card: open && options?.card === true,
    // Only worth explaining while there is still something to pay.
    cardUnavailableReason: open && options?.card !== true ? (options?.cardUnavailableReason ?? null) : null,
    // Someone can always be shown where to send money.
    zelle: open || status === "REQUIRES_VERIFICATION",
  };
}
