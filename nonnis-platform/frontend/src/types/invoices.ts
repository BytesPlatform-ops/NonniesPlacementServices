export type InvoiceStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "SENT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REQUIRES_VERIFICATION";

/**
 * What an invoice can come back as.
 *
 * Nonni's is paid by card or by Zelle. "CASH" and "BANK_TRANSFER" are no longer
 * offered but stay in the union because the database enum can still return
 * them, and a screen must render a row it did not create rather than crash.
 */
export type InvoicePaymentMethod = "STRIPE" | "ZELLE" | "CASH" | "BANK_TRANSFER";
export type InvoiceBillingType = "ONE_TIME" | "RECURRING";
export type ProductCategory = "PLATFORM_SUBSCRIPTION" | "PLACEMENT_SERVICE";

export interface InvoiceItemView {
  id: string;
  name: string;
  description: string | null;
  /** Money and quantities are strings: a JSON number is a double. */
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  position: number;
}

export interface InvoicePaymentView {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
  reference: string | null;
  verified: boolean;
  verifiedAt: string | null;
}

export interface InvoiceEventView {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  createdAt: string;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  provider: { id: string; name: string; email: string | null };
  caseId: string | null;
  orderId: string | null;
  status: InvoiceStatus;
  billingType: InvoiceBillingType;
  paymentMethod: InvoicePaymentMethod;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  hasStripeSession: boolean;
  recurringInterval: string | null;
  recurringPeriods: number | null;
  recurringStartAt: string | null;
  recurringEndsAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: InvoiceItemView[];
  payments: InvoicePaymentView[];
  events: InvoiceEventView[];
}

export interface ProductView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  active: boolean;
  recurring: boolean;
  /** A starting figure only — never the charged amount. */
  suggestedUnitPrice: string | null;
  currency: string;
  updatedAt: string;
}

export interface PaymentHistoryRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  provider: { id: string; name: string };
  amount: string;
  currency: string;
  method: string;
  status: string;
  paidAt: string;
  reference: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItemInput {
  productId?: string;
  name: string;
  description?: string;
  quantity: string;
  unitPrice: string;
}
