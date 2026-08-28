import { apiGet } from "@/lib/api-client";
import type { DischargeDashboard } from "@/types/dashboard";

export function getDischargeDashboard(): Promise<DischargeDashboard> {
  return apiGet<DischargeDashboard>("/api/v1/dashboard/discharge-professional");
}
