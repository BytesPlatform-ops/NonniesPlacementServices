import { Prisma } from "@prisma/client";

/**
 * Shared helpers for the reporting module: timezone-safe date-range parsing,
 * enum humanisation for readable exports, name resolution for raw-UUID columns,
 * and the common report response contract.
 */

/** Every report response follows this envelope (a superset of PaginatedResult). */
export interface ReportResponse<Row, Summary, Groups> {
  appliedFilters: Record<string, unknown>;
  generatedAt: string;
  summary: Summary;
  groups: Groups;
  items: Row[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A single labelled count used by grouped-summary tables. */
export interface GroupCount {
  key: string;
  label: string;
  count: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Build a Prisma date filter from inclusive `YYYY-MM-DD` bounds, interpreted in
 * UTC. `dateFrom` starts at 00:00:00Z of that day; `dateTo` is inclusive through
 * the end of that day (exclusive upper bound at the next midnight). Returns
 * undefined when neither bound is set so the caller applies no date filter.
 */
export function buildDateRange(
  dateFrom?: string,
  dateTo?: string,
): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};
  if (dateFrom && DATE_ONLY.test(dateFrom)) {
    const [y, m, d] = dateFrom.split("-").map(Number);
    filter.gte = new Date(Date.UTC(y, m - 1, d));
  }
  if (dateTo && DATE_ONLY.test(dateTo)) {
    const [y, m, d] = dateTo.split("-").map(Number);
    filter.lt = new Date(Date.UTC(y, m - 1, d + 1));
  }
  return filter.gte || filter.lt ? filter : undefined;
}

/** Turn an enum code (READY_FOR_REVIEW) into a readable label (Ready For Review). */
export function humanizeEnum(code: string | null | undefined): string {
  if (!code) return "";
  return code
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** ISO string or null for a nullable Date column. */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** `asc` when explicitly requested, otherwise `desc`. */
export function sortOrder(order: string | undefined): "asc" | "desc" {
  return order === "asc" ? "asc" : "desc";
}

/** Whitelist a sort field, falling back to a safe default. */
export function sortField(requested: string | undefined, allowed: string[], fallback: string): string {
  return requested && allowed.includes(requested) ? requested : fallback;
}

export interface Paged {
  page: number;
  pageSize: number;
}

export function skipTake(query: Paged): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function totalPages(total: number, pageSize: number): number {
  return total === 0 ? 0 : Math.ceil(total / pageSize);
}
