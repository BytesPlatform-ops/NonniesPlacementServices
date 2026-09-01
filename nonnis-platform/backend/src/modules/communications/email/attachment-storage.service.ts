import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../../config/configuration";

/** Dedicated PRIVATE bucket for communication attachments — never public-read. */
export const COMMUNICATIONS_BUCKET = "nonnis-communications-private";

const DOWNLOAD_URL_TTL_SECONDS = 60; // short-lived signed download links only

/**
 * Private Supabase Storage for communication attachments. The service-role key
 * stays on the backend. Outbound: the browser uploads directly via a short-lived
 * signed upload URL. Inbound: the backend fetches provider attachments and uploads
 * the bytes server-side. Downloads are always short-lived signed URLs — there is no
 * public/permanent attachment URL, and the raw storagePath is never exposed.
 */
@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(`Private attachment bucket setup skipped: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.config.get("supabaseUrl", { infer: true });
    const serviceKey = this.config.get("supabaseServiceRoleKey", { infer: true });
    if (!url || !serviceKey) throw new ServiceUnavailableException("Attachment storage is not configured.");
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client;
  }

  /** Idempotently ensure the PRIVATE bucket (public:false — no anonymous access). */
  async ensureBucket(): Promise<void> {
    const storage = this.getClient().storage;
    const { data: existing } = await storage.getBucket(COMMUNICATIONS_BUCKET);
    if (existing) return;
    const { error } = await storage.createBucket(COMMUNICATIONS_BUCKET, { public: false });
    if (error && !/exists|already/i.test(error.message)) throw error;
    this.logger.log(`Ensured PRIVATE Supabase bucket "${COMMUNICATIONS_BUCKET}".`);
  }

  /** Mint a short-lived signed direct-upload URL for an outbound attachment path. */
  async createSignedUploadUrl(path: string): Promise<{ path: string; token: string; signedUrl: string }> {
    const { data, error } = await this.getClient().storage.from(COMMUNICATIONS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new ServiceUnavailableException(`Could not create an upload URL: ${error?.message ?? "unknown error"}`);
    return { path, token: data.token, signedUrl: data.signedUrl };
  }

  /** Upload bytes server-side (used for fetched inbound attachments). */
  async uploadBuffer(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.getClient().storage.from(COMMUNICATIONS_BUCKET).upload(path, buffer, { contentType, upsert: false });
    if (error) throw new ServiceUnavailableException(`Could not store attachment: ${error.message}`);
  }

  /** Confirm an object exists at path (used to validate a browser-completed upload). */
  async objectExists(path: string): Promise<boolean> {
    const slash = path.lastIndexOf("/");
    const dir = slash >= 0 ? path.slice(0, slash) : "";
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const { data, error } = await this.getClient().storage.from(COMMUNICATIONS_BUCKET).list(dir, { search: name, limit: 1 });
    if (error) return false;
    return !!data?.some((o) => o.name === name);
  }

  /** Download object bytes server-side (used to attach outbound files to a provider send). */
  async downloadBuffer(path: string): Promise<Buffer | null> {
    const { data, error } = await this.getClient().storage.from(COMMUNICATIONS_BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  /** Short-lived signed download URL — the only way staff retrieve an attachment. */
  async createSignedDownloadUrl(path: string, downloadName?: string): Promise<string> {
    const { data, error } = await this.getClient().storage.from(COMMUNICATIONS_BUCKET).createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
    if (error || !data?.signedUrl) throw new ServiceUnavailableException(`Could not create a download URL: ${error?.message ?? "unknown error"}`);
    return data.signedUrl;
  }
}
