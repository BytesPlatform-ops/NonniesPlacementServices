import { apiDelete, apiPost } from "@/lib/api-client";

export type MediaKind = "blog-featured" | "video" | "poster" | "email-image";

export interface MediaValue {
  url: string | null;
  storagePath: string | null;
}

interface UploadTicket {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
export const VIDEO_ACCEPT = "video/mp4,video/webm";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

/** PUT the file directly to the Supabase signed upload URL, reporting progress. */
function putSignedUrl(signedUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.send(file);
  });
}

/**
 * Request a signed upload URL from the backend (which validates permission +
 * MIME/size), then upload the file DIRECTLY to Supabase Storage. The large file
 * never passes through the Nest backend. Returns the final public URL + the
 * managed storage path (for safe replacement/deletion).
 */
export async function uploadMedia(kind: MediaKind, file: File, onProgress?: (pct: number) => void): Promise<MediaValue> {
  const ticket = await apiPost<UploadTicket>("/api/v1/content/media/upload-url", {
    kind,
    contentType: file.type,
    sizeBytes: file.size,
    filename: file.name,
  });
  await putSignedUrl(ticket.signedUrl, file, onProgress);
  return { url: ticket.publicUrl, storagePath: ticket.path };
}

/** Best-effort delete of a managed storage object (e.g. an unsaved replaced upload). */
export async function deleteMedia(storagePath: string): Promise<void> {
  try {
    await apiDelete<{ deleted: boolean }>("/api/v1/content/media", { storagePath });
  } catch {
    /* best-effort cleanup — never block the UI */
  }
}

/** Upload a public provider image via the provider-scoped signed-URL endpoint. */
export async function uploadProviderImage(
  providerId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MediaValue> {
  const ticket = await apiPost<UploadTicket>(`/api/v1/providers/${providerId}/public-listing/image-upload-url`, {
    contentType: file.type,
    sizeBytes: file.size,
    filename: file.name,
  });
  await putSignedUrl(ticket.signedUrl, file, onProgress);
  return { url: ticket.publicUrl, storagePath: ticket.path };
}

/** Best-effort delete of a managed provider image object. */
export async function deleteProviderImage(providerId: string, storagePath: string): Promise<void> {
  try {
    await apiDelete<{ ok: boolean }>(`/api/v1/providers/${providerId}/public-listing/image`, { storagePath });
  } catch {
    /* best-effort cleanup */
  }
}
