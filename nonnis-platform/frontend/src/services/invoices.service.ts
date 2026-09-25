import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { InvoiceItemInput, InvoiceView, PaymentHistoryRow, ProductView } from "@/types/invoices";

const ADMIN = "/api/v1/invoices";
const PROVIDER = "/api/v1/provider-portal/invoices";

function qs(f: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- admin ------------------------------------------------------------------
export function listInvoices(f: { status?: string; providerId?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<InvoiceView>> {
  return apiGet(`${ADMIN}${qs(f)}`);
}
export function getInvoice(id: string): Promise<InvoiceView> {
  return apiGet(`${ADMIN}/${id}`);
}
export function createInvoice(body: {
  providerId: string;
  items: InvoiceItemInput[];
  taxRate?: string;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  paymentMethod?: string;
  billingType?: string;
  recurringInterval?: string;
  recurringPeriods?: number;
  recurringStartAt?: string;
  notes?: string;
}): Promise<InvoiceView> {
  return apiPost(ADMIN, body);
}
export function updateInvoice(id: string, body: Record<string, unknown>): Promise<InvoiceView> {
  return apiPatch(`${ADMIN}/${id}`, body);
}
export function submitInvoiceForReview(id: string): Promise<InvoiceView> {
  return apiPost(`${ADMIN}/${id}/submit-for-review`);
}
export function approveInvoice(id: string): Promise<InvoiceView> {
  return apiPost(`${ADMIN}/${id}/approve`);
}
export function sendInvoice(id: string): Promise<InvoiceView> {
  return apiPost(`${ADMIN}/${id}/send`);
}
export function cancelInvoice(id: string): Promise<InvoiceView> {
  return apiPost(`${ADMIN}/${id}/cancel`);
}
export function verifyInvoicePayment(id: string, body: { amount?: string; method?: string; reference?: string }): Promise<InvoiceView> {
  return apiPost(`${ADMIN}/${id}/verify-payment`, body);
}
export function listPaymentHistory(f: { status?: string; providerId?: string; page?: number } = {}): Promise<PaginatedResult<PaymentHistoryRow>> {
  return apiGet(`${ADMIN}/payments/history${qs(f)}`);
}

// ---- products ---------------------------------------------------------------
export function listProducts(activeOnly = false): Promise<ProductView[]> {
  return apiGet(`/api/v1/invoice-products${activeOnly ? "?activeOnly=true" : ""}`);
}
export function updateProductPricing(id: string, body: { suggestedUnitPrice?: string | null; currency?: string; active?: boolean }): Promise<ProductView> {
  return apiPatch(`/api/v1/invoice-products/${id}/pricing`, body);
}

// ---- provider ---------------------------------------------------------------
export function listMyInvoices(f: { status?: string; page?: number } = {}): Promise<PaginatedResult<InvoiceView>> {
  return apiGet(`${PROVIDER}${qs(f)}`);
}
export function getMyInvoice(id: string): Promise<InvoiceView> {
  return apiGet(`${PROVIDER}/${id}`);
}
export function reportMyInvoicePayment(id: string, body: { reference?: string }): Promise<InvoiceView> {
  return apiPost(`${PROVIDER}/${id}/report-payment`, body);
}

/**
 * The ways this provider may settle a Nonni's invoice.
 *
 * Asked once per screen rather than derived from the invoice, because how to
 * pay is the provider's choice at payment time — not something recorded when
 * the invoice was raised.
 */
export function getPaymentOptions(): Promise<{
  card: boolean;
  cardUnavailableReason: string | null;
  zelle: boolean;
  zelleRecipient: string;
  zelleQrUrl: string;
}> {
  return apiGet(`${PROVIDER}/payment-options`);
}

/**
 * Start a card payment and get the hosted page to send the payer to.
 *
 * The body is empty on purpose: the amount comes from the stored invoice, so
 * there is nothing here the browser could tamper with. Card details are entered
 * on Stripe's own page and never touch this application.
 */
export function startMyInvoiceCardPayment(id: string): Promise<{ url: string }> {
  return apiPost(`${PROVIDER}/${id}/checkout-session`, {});
}

/** The PDF is rendered server-side from the record; this just opens it. */
export function invoicePdfUrl(id: string, scope: "admin" | "provider"): string {
  return `${scope === "admin" ? ADMIN : PROVIDER}/${id}/pdf`;
}
