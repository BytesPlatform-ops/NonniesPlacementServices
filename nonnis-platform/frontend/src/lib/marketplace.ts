import type { MarketplaceListing, MarketplaceOrder } from "@/types/marketplace";
import type { StatusTone } from "@/lib/case-status";

/**
 * Money arrives as a decimal string and is formatted, never parsed into a
 * float — 1200.10 must not become 1200.0999999.
 */
export function formatMoney(amount: string, currency: string): string {
  const [whole = "0", cents = "00"] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = currency === "USD" ? "$" : "";
  return symbol ? `${symbol}${grouped}.${cents}` : `${grouped}.${cents} ${currency}`;
}

const PERIOD_SUFFIX: Record<string, string> = { DAILY: "/ day", WEEKLY: "/ week", MONTHLY: "/ month" };

/** "$1,200.00 / month" for a rental, "$1,200.00" for a sale. */
export function formatListingPrice(listing: Pick<MarketplaceListing, "price" | "currency" | "billingPeriod">): string {
  const base = formatMoney(listing.price, listing.currency);
  return listing.billingPeriod ? `${base} ${PERIOD_SUFFIX[listing.billingPeriod] ?? ""}`.trim() : base;
}

export const LISTING_TYPE_LABELS: Record<string, string> = {
  BED: "Bed",
  PRIVATE_ROOM: "Private room",
  SHARED_ROOM: "Shared room",
  UNIT: "Unit",
  OTHER: "Other",
};

export const listingTypeLabel = (code: string): string => LISTING_TYPE_LABELS[code] ?? code;

export const transactionLabel = (t: string): string => (t === "RENT" ? "For rent" : "For sale");

export function listingStatusTone(status: MarketplaceListing["status"]): StatusTone {
  switch (status) {
    case "PUBLISHED":
      return "positive";
    case "DRAFT":
      return "neutral";
    case "UNAVAILABLE":
      return "warning";
    default:
      return "neutral";
  }
}

export function orderStatusTone(status: MarketplaceOrder["status"]): StatusTone {
  switch (status) {
    case "REQUESTED":
      return "info";
    case "ACCEPTED":
    case "ACTIVE":
      return "progress";
    case "COMPLETED":
      return "positive";
    case "DECLINED":
    case "CANCELLED":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * What the buyer is waiting for, in one phrase. Order status and payment
 * status are two separate facts and are never merged in the data — this is
 * only the sentence that reads them together.
 */
export function orderProgressLabel(order: MarketplaceOrder): string {
  if (order.status === "ACCEPTED" && order.paymentStatus === "UNPAID") return "Cash payment pending";
  if (order.status === "ACCEPTED" && order.paymentStatus === "PAID") return "Payment received";
  return order.statusLabel;
}
