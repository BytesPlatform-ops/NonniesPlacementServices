import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../config/configuration";

/** One dedicated, public-read bucket for all Nonnis website CMS media. */
export const CONTENT_BUCKET = "nonnis-content";

export type MediaKind = "blog-featured" | "video" | "poster" | "provider-public";

/** MIME → extension allow-lists. Anything not listed is rejected. */
const IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB

/** Server-generated folder per media kind — user paths are never trusted. */
const FOLDERS: Record<MediaKind, string> = {
  "blog-featured": "blog/featured",
  video: "videos",
  poster: "videos/posters",
  "provider-public": "providers/public",
};
const MANAGED_PREFIXES = Object.values(FOLDERS).map((f) => `${f}/`);

export interface UploadTicket {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

/**
 * Supabase Storage integration for CMS media. The service-role key stays here on
 * the backend — the browser uploads DIRECTLY to Storage using a short-lived
 * signed upload URL minted here (no large file is ever proxied through Nest).
 */
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    // Best-effort idempotent bucket setup; never crash boot if Storage is down.
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(`Content bucket setup skipped: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.config.get("supabaseUrl", { infer: true });
    const serviceKey = this.config.get("supabaseServiceRoleKey", { infer: true });
    if (!url || !serviceKey) {
      throw new ServiceUnavailableException("Media storage is not configured.");
    }
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client;
  }

  /** Idempotent: create the public bucket only if it does not already exist. */
  async ensureBucket(): Promise<void> {
    const storage = this.getClient().storage;
    const { data: existing } = await storage.getBucket(CONTENT_BUCKET);
    if (existing) return;
    // No per-bucket fileSizeLimit: it may not exceed the project's global upload
    // limit (Supabase returns 413). Size is enforced in `validate()` instead; to
    // accept very large videos, raise the project's global limit in Supabase.
    const { error } = await storage.createBucket(CONTENT_BUCKET, { public: true });
    // Tolerate a concurrent creation race.
    if (error && !/exists|already/i.test(error.message)) throw error;
    this.logger.log(`Ensured Supabase Storage bucket "${CONTENT_BUCKET}" (public read).`);
  }

  private validate(kind: MediaKind, contentType: string, sizeBytes?: number): string {
    const isVideo = kind === "video";
    const allowed = isVideo ? VIDEO_MIME : IMAGE_MIME;
    const ext = allowed[contentType];
    if (!ext) {
      throw new BadRequestException(`Unsupported ${isVideo ? "video" : "image"} type: ${contentType}`);
    }
    const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (sizeBytes !== undefined && sizeBytes > max) {
      throw new BadRequestException(`File exceeds the ${Math.round(max / (1024 * 1024))} MB limit.`);
    }
    return ext;
  }

  /** Mint a signed direct-upload URL for a validated media intent. */
  async createUploadTicket(kind: MediaKind, contentType: string, sizeBytes?: number): Promise<UploadTicket> {
    const ext = this.validate(kind, contentType, sizeBytes);
    const path = `${FOLDERS[kind]}/${randomUUID()}.${ext}`;
    const storage = this.getClient().storage.from(CONTENT_BUCKET);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      throw new ServiceUnavailableException(`Could not create an upload URL: ${error?.message ?? "unknown error"}`);
    }
    return { bucket: CONTENT_BUCKET, path, token: data.token, signedUrl: data.signedUrl, publicUrl: this.publicUrl(path) };
  }

  /** Public CDN URL for an object path in the content bucket. */
  publicUrl(path: string): string {
    return this.getClient().storage.from(CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** True only for object paths inside the managed content-bucket folders. */
  isManagedPath(path: string | null | undefined): path is string {
    return typeof path === "string" && MANAGED_PREFIXES.some((p) => path.startsWith(p));
  }

  /** Delete a managed object. External/non-managed paths are ignored (never deleted). */
  async deleteObject(path: string | null | undefined): Promise<void> {
    if (!this.isManagedPath(path)) return;
    try {
      const { error } = await this.getClient().storage.from(CONTENT_BUCKET).remove([path]);
      if (error) this.logger.warn(`Failed to remove storage object ${path}: ${error.message}`);
    } catch (err) {
      this.logger.warn(`Failed to remove storage object ${path}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
}
