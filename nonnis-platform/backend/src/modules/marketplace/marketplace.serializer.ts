import { Prisma } from "@prisma/client";

/**
 * Marketplace projections.
 *
 * Field-by-field, never a spread of a Prisma row — the same rule the family
 * portal follows. A provider's internal notes, licence details, organization
 * ids and storage keys must never reach a buyer, and a column added to
 * `Provider` or `ProviderListing` tomorrow cannot leak through by accident.
 *
 * Money crosses the wire as a decimal STRING. `Decimal` is not JSON-native and
 * a float would silently lose cents.
 */

export const listingInclude = {
  images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  provider: { select: { id: true, displayName: true, city: true, state: true, phone: true } },
  serviceCategory: { select: { id: true, name: true } },
} satisfies Prisma.ProviderListingInclude;

export type ListingRow = Prisma.ProviderListingGetPayload<{ include: typeof listingInclude }>;

export const orderInclude = {
  listing: { select: { id: true, title: true, listingType: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
  provider: { select: { id: true, displayName: true, city: true, state: true, phone: true } },
} satisfies Prisma.MarketplaceOrderInclude;

export type OrderRow = Prisma.MarketplaceOrderGetPayload<{ include: typeof orderInclude }>;

export interface ListingImageView {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
}

export interface ListingView {
  id: string;
  title: string;
  description: string | null;
  listingType: string;
  transactionType: string;
  price: string;
  currency: string;
  billingPeriod: string | null;
  depositAmount: string | null;
  availableQuantity: number;
  /** Derived, never stored, so it can never disagree with the quantity. */
  soldOut: boolean;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  availableFrom: string | null;
  amenities: string[];
  restrictions: string | null;
  serviceCategory: { id: string; name: string } | null;
  status: string;
  publishedAt: string | null;
  images: ListingImageView[];
  primaryImageUrl: string | null;
  provider: { id: string; name: string; city: string | null; state: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  listingType: string | null;
  primaryImageUrl: string | null;
  provider: { id: string; name: string; city: string | null; state: string | null; phone: string | null };
  transactionType: string;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  currency: string;
  billingPeriod: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  statusLabel: string;
  seekerNote: string | null;
  declineReason: string | null;
  caseId: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** What the buyer sees in place of a raw enum pair. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Request sent",
  ACCEPTED: "Provider accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  ACTIVE: "Active rental",
  COMPLETED: "Completed",
};

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const money = (d: Prisma.Decimal | null | undefined): string | null => (d === null || d === undefined ? null : d.toFixed(2));

export function toListingView(row: ListingRow): ListingView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    listingType: row.listingType,
    transactionType: row.transactionType,
    price: money(row.price)!,
    currency: row.currency,
    billingPeriod: row.billingPeriod,
    depositAmount: money(row.depositAmount),
    availableQuantity: row.availableQuantity,
    soldOut: row.availableQuantity <= 0,
    addressLine1: row.addressLine1,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    availableFrom: row.availableFrom ? row.availableFrom.toISOString() : null,
    amenities: row.amenities,
    restrictions: row.restrictions,
    serviceCategory: row.serviceCategory ? { id: row.serviceCategory.id, name: row.serviceCategory.name } : null,
    status: row.status,
    publishedAt: iso(row.publishedAt),
    images: row.images.map((i) => ({ id: i.id, imageUrl: i.imageUrl, altText: i.altText, sortOrder: i.sortOrder })),
    primaryImageUrl: row.images[0]?.imageUrl ?? null,
    provider: { id: row.provider.id, name: row.provider.displayName, city: row.provider.city, state: row.provider.state },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Never projected: providerId's organization, internalNotes, licence fields,
    // image storage paths, createdByUserId.
  };
}

export function toOrderView(row: OrderRow): OrderView {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    listingType: row.listing?.listingType ?? null,
    primaryImageUrl: row.listing?.images[0]?.imageUrl ?? null,
    provider: {
      id: row.provider.id,
      name: row.provider.displayName,
      city: row.provider.city,
      state: row.provider.state,
      phone: row.provider.phone,
    },
    transactionType: row.transactionType,
    quantity: row.quantity,
    unitPrice: money(row.unitPrice)!,
    totalAmount: money(row.totalAmount)!,
    currency: row.currency,
    billingPeriod: row.billingPeriod,
    requestedStartDate: iso(row.requestedStartDate),
    requestedEndDate: iso(row.requestedEndDate),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    status: row.status,
    statusLabel: ORDER_STATUS_LABELS[row.status] ?? row.status,
    seekerNote: row.seekerNote,
    declineReason: row.declineReason,
    caseId: row.caseId,
    acceptedAt: iso(row.acceptedAt),
    declinedAt: iso(row.declinedAt),
    cancelledAt: iso(row.cancelledAt),
    paidAt: iso(row.paidAt),
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    // Never projected: seekerUserId, paidByUserId, quantityReleasedAt.
  };
}
