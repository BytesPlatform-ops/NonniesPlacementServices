import { apiGet, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { CommunicationsConfiguration, CommunicationsHealth, DeliveryFailureView, DeliverySource } from "@/types/communications-operations";

const BASE = "/api/v1/communications";

function qs(f: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listDeliveryFailures(f: { channel?: string; source?: string; status?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<DeliveryFailureView>> {
  return apiGet(`${BASE}/delivery${qs(f)}`);
}

export function retryDelivery(id: string, source: DeliverySource, acknowledgeDuplicateRisk = false): Promise<{ ok: true }> {
  return apiPost(`${BASE}/delivery/${id}/retry`, { source, acknowledgeDuplicateRisk });
}

export function getCommunicationsConfiguration(): Promise<CommunicationsConfiguration> {
  return apiGet(`${BASE}/configuration`);
}

export function getCommunicationsHealth(): Promise<CommunicationsHealth> {
  return apiGet(`${BASE}/health`);
}
