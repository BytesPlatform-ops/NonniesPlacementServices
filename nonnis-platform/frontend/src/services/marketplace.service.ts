import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { ListingInput, MarketplaceListing, MarketplaceOrder } from "@/types/marketplace";

function qs(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `?${s}` : "";
}

// ---- provider: listings -----------------------------------------------------

export function listProviderListings(
  params: { page?: number; status?: string; q?: string } = {},
): Promise<PaginatedResult<MarketplaceListing>> {
  return apiGet<PaginatedResult<MarketplaceListing>>(`/api/v1/provider/listings${qs(params)}`);
}

export function getProviderListing(id: string): Promise<MarketplaceListing> {
  return apiGet<MarketplaceListing>(`/api/v1/provider/listings/${id}`);
}

export function createProviderListing(body: ListingInput): Promise<MarketplaceListing> {
  return apiPost<MarketplaceListing>("/api/v1/provider/listings", body);
}

export function updateProviderListing(id: string, body: Partial<ListingInput>): Promise<MarketplaceListing> {
  return apiPatch<MarketplaceListing>(`/api/v1/provider/listings/${id}`, body);
}

export function setProviderListingStatus(id: string, status: string): Promise<MarketplaceListing> {
  return apiPatch<MarketplaceListing>(`/api/v1/provider/listings/${id}/status`, { status });
}

export function addProviderListingImage(
  id: string,
  body: { imageUrl: string; storagePath?: string; altText?: string },
): Promise<MarketplaceListing> {
  return apiPost<MarketplaceListing>(`/api/v1/provider/listings/${id}/images`, body);
}

export function removeProviderListingImage(id: string, imageId: string): Promise<MarketplaceListing> {
  return apiDelete<MarketplaceListing>(`/api/v1/provider/listings/${id}/images/${imageId}`);
}

export interface ListingUploadTicket {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

/** Uploads a listing photo and returns the public URL to attach to the listing. */
export async function uploadListingImage(file: File): Promise<{ imageUrl: string; storagePath: string }> {
  const ticket = await apiPost<ListingUploadTicket>("/api/v1/provider/listings/image-upload-url", {
    contentType: file.type,
    sizeBytes: file.size,
  });
  const response = await fetch(ticket.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("The image could not be uploaded.");
  return { imageUrl: ticket.publicUrl, storagePath: ticket.path };
}

// ---- provider: orders -------------------------------------------------------

export function listProviderOrders(
  params: { page?: number; status?: string } = {},
): Promise<PaginatedResult<MarketplaceOrder>> {
  return apiGet<PaginatedResult<MarketplaceOrder>>(`/api/v1/provider/marketplace-orders${qs(params)}`);
}

const orderAction = (id: string, action: string, body?: unknown) =>
  apiPost<MarketplaceOrder>(`/api/v1/provider/marketplace-orders/${id}/${action}`, body);

export const acceptOrder = (id: string) => orderAction(id, "accept");
export const declineOrder = (id: string, reason?: string) => orderAction(id, "decline", { reason });
export const recordCashPayment = (id: string) => orderAction(id, "record-cash-payment");
export const startRental = (id: string) => orderAction(id, "start-rental");
export const completeOrder = (id: string) => orderAction(id, "complete");
export const cancelAcceptedOrder = (id: string, reason?: string) => orderAction(id, "cancel", { reason });

// ---- seeker -----------------------------------------------------------------

export function browseMarketplace(
  params: { page?: number; q?: string; transactionType?: string; listingType?: string; city?: string } = {},
): Promise<PaginatedResult<MarketplaceListing>> {
  return apiGet<PaginatedResult<MarketplaceListing>>(`/api/v1/seeker/marketplace/listings${qs(params)}`);
}

export function getMarketplaceListing(id: string): Promise<MarketplaceListing> {
  return apiGet<MarketplaceListing>(`/api/v1/seeker/marketplace/listings/${id}`);
}

export function createMarketplaceOrder(body: {
  listingId: string;
  quantity: number;
  note?: string;
  requestedStartDate?: string;
  requestedEndDate?: string;
  caseId?: string;
}): Promise<MarketplaceOrder> {
  return apiPost<MarketplaceOrder>("/api/v1/seeker/marketplace/orders", body);
}

export function listMyMarketplaceOrders(params: { page?: number } = {}): Promise<PaginatedResult<MarketplaceOrder>> {
  return apiGet<PaginatedResult<MarketplaceOrder>>(`/api/v1/seeker/marketplace/orders${qs(params)}`);
}

export function cancelMyMarketplaceOrder(id: string): Promise<MarketplaceOrder> {
  return apiPost<MarketplaceOrder>(`/api/v1/seeker/marketplace/orders/${id}/cancel`);
}

// ---- admin ------------------------------------------------------------------

export function adminListListings(
  params: { page?: number; status?: string; q?: string } = {},
): Promise<PaginatedResult<MarketplaceListing>> {
  return apiGet<PaginatedResult<MarketplaceListing>>(`/api/v1/marketplace/listings${qs(params)}`);
}

export function adminListOrders(params: { page?: number } = {}): Promise<PaginatedResult<MarketplaceOrder>> {
  return apiGet<PaginatedResult<MarketplaceOrder>>(`/api/v1/marketplace/orders${qs(params)}`);
}

export function adminModerateListing(id: string, status: string): Promise<MarketplaceListing> {
  return apiPatch<MarketplaceListing>(`/api/v1/marketplace/listings/${id}/status`, { status });
}

export function adminRecordCashPayment(id: string): Promise<MarketplaceOrder> {
  return apiPost<MarketplaceOrder>(`/api/v1/marketplace/orders/${id}/record-cash-payment`);
}
