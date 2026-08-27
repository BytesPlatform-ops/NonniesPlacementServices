import { API_BASE_URL } from "./config";
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

/** GET a resource and unwrap the normalized `{ data }` envelope. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the API. Is the backend running?");
  }

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
