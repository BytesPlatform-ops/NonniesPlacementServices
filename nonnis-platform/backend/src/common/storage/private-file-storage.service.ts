import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../config/configuration";

/**
 * Bucket-agnostic private object storage on Supabase.
 *
 * Every bucket it touches is created with `public: false`, so no object is ever
 * anonymously readable. Callers receive short-lived signed URLs and never the
 * raw storage path — the path is an internal key, not an address.
 *
 * The service-role key stays on the backend and is read lazily so that a
 * deployment without storage configured still boots; the failure surfaces on
 * first use as a 503 rather than at startup.
 */
@Injectable()
export class PrivateFileStorageService {
  private readonly logger = new Logger(PrivateFileStorageService.name);
  private client: SupabaseClient | null = null;
  private readonly ensured = new Set<string>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.config.get("supabaseUrl", { infer: true });
    const serviceKey = this.config.get("supabaseServiceRoleKey", { infer: true });
    if (!url || !serviceKey) throw new ServiceUnavailableException("File storage is not configured.");
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client;
  }

  /**
   * Strip anything that could break out of a Content-Disposition header.
   * Supabase echoes the download name into that header, so quotes, control
   * characters and path separators must never survive a submitter-chosen
   * filename.
   */
  static headerSafeFilename(name: string): string {
    // eslint-disable-next-line no-control-regex
    const cleaned = (name || "file").replace(/[\x00-\x1f\x7f]/g, "").replace(/["\\/]/g, "_").replace(/[\r\n;]/g, "").trim();
    return cleaned.slice(0, 150) || "file";
  }

  /** Idempotently ensure a PRIVATE bucket exists. Cached per process. */
  async ensureBucket(bucket: string): Promise<void> {
    if (this.ensured.has(bucket)) return;
    const storage = this.getClient().storage;
    const { data: existing } = await storage.getBucket(bucket);
    if (!existing) {
      const { error } = await storage.createBucket(bucket, { public: false });
      if (error && !/exists|already/i.test(error.message)) throw error;
      this.logger.log(`Ensured PRIVATE Supabase bucket "${bucket}".`);
    }
    this.ensured.add(bucket);
  }

  /** Upload bytes server-side. Never overwrites an existing object. */
  async uploadBuffer(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket(bucket);
    const { error } = await this.getClient().storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
    if (error) throw new ServiceUnavailableException(`Could not store the file: ${error.message}`);
  }

  /** Short-lived signed download URL — the only way a stored file is reachable. */
  async createSignedDownloadUrl(bucket: string, path: string, ttlSeconds: number, downloadName?: string): Promise<string> {
    const safeName = downloadName ? PrivateFileStorageService.headerSafeFilename(downloadName) : undefined;
    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .createSignedUrl(path, ttlSeconds, safeName ? { download: safeName } : undefined);
    if (error || !data?.signedUrl) throw new ServiceUnavailableException(`Could not create a download URL: ${error?.message ?? "unknown error"}`);
    return data.signedUrl;
  }

  /** Best-effort delete. A missing object is not an error. */
  async removeObjects(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.getClient().storage.from(bucket).remove(paths);
    if (error) this.logger.warn(`Could not remove ${paths.length} object(s) from "${bucket}": ${error.message}`);
  }
}
