export interface MarketplaceListingImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string | null;
  listingType: string;
  transactionType: "RENT" | "SALE";
  /** Decimal as a string — never parsed into a float for display. */
  price: string;
  currency: string;
  billingPeriod: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  depositAmount: string | null;
  availableQuantity: number;
  soldOut: boolean;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  availableFrom: string | null;
  amenities: string[];
  restrictions: string | null;
  serviceCategory: { id: string; name: string } | null;
  status: "DRAFT" | "PUBLISHED" | "UNAVAILABLE" | "ARCHIVED";
  publishedAt: string | null;
  images: MarketplaceListingImage[];
  primaryImageUrl: string | null;
  provider: { id: string; name: string; city: string | null; state: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceOrder {
  id: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  listingType: string | null;
  primaryImageUrl: string | null;
  provider: { id: string; name: string; city: string | null; state: string | null; phone: string | null };
  transactionType: "RENT" | "SALE";
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  currency: string;
  billingPeriod: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  paymentMethod: string;
  paymentStatus: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
  status: "REQUESTED" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "ACTIVE" | "COMPLETED";
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

export interface ListingInput {
  title: string;
  description?: string;
  listingType: string;
  transactionType: "RENT" | "SALE";
  price: string;
  billingPeriod?: "DAILY" | "WEEKLY" | "MONTHLY";
  depositAmount?: string;
  availableQuantity: number;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  availableFrom?: string;
  amenities?: string[];
  restrictions?: string;
}
