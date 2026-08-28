import { API_BASE_URL } from "./config";
import { getActiveOrg } from "./active-org";
import { supabaseBrowser } from "./supabase/client";
import type { ApiErrorBody, ApiSuccess } from "@/types/api";

/** Error raised for any non-2xx API response or network failure. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Centrally attach the bearer token and active-organization header. */
async function buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json", ...(extra ?? {}) };
  try {
    const { data } = await supabaseBrowser().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* no session */
  }
  const org = getActiveOrg();
  if (org) headers["X-Organization-Id"] = org;
  return headers;
}

async function unwrap<T>(response: Response): Promise<T> {
  const text = await response.text();
  const json = text ? safeParse(text) : undefined;
  if (!response.ok) {
    const body = json as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "ERROR",
      body?.error?.message ?? (response.statusText || "Request failed."),
      body?.error?.details,
    );
  }
  return (json as ApiSuccess<T>).data;
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: await buildHeaders(), cache: "no-store" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the API. Is the backend running?");
  }
  return unwrap<T>(response);
}

async function apiSend<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: await buildHeaders({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the API. Is the backend running?");
  }
  return unwrap<T>(response);
}

export const apiPost = <T>(path: string, body?: unknown): Promise<T> => apiSend<T>("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> => apiSend<T>("PATCH", path, body);
export const apiPut = <T>(path: string, body?: unknown): Promise<T> => apiSend<T>("PUT", path, body);
export const apiDelete = <T>(path: string): Promise<T> => apiSend<T>("DELETE", path);
