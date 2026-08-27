import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../config/configuration";
import type { TokenVerifier, VerifiedIdentity } from "./token-verifier";

/**
 * Supabase Auth integration. Verifies access tokens server-side (signature
 * validated by Supabase, not merely decoded) and performs trusted admin
 * operations (invitations) with the service-role key.
 *
 * SECURITY: the service-role client is created lazily and used only here on the
 * backend. Neither the key nor tokens are ever logged.
 */
@Injectable()
export class SupabaseService implements TokenVerifier {
  private readonly logger = new Logger(SupabaseService.name);
  private authClient: SupabaseClient | null = null;
  private adminClient: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private getAuthClient(): SupabaseClient {
    if (this.authClient) return this.authClient;
    const url = this.config.get("supabaseUrl", { infer: true });
    const anonKey = this.config.get("supabaseAnonKey", { infer: true });
    if (!url || !anonKey) {
      throw new Error("Supabase URL / anon key are not configured.");
    }
    this.authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.authClient;
  }

  private getAdminClient(): SupabaseClient {
    if (this.adminClient) return this.adminClient;
    const url = this.config.get("supabaseUrl", { infer: true });
    const serviceKey = this.config.get("supabaseServiceRoleKey", { infer: true });
    if (!url || !serviceKey) {
      throw new Error("Supabase service-role credentials are not configured.");
    }
    this.adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.adminClient;
  }

  async verify(accessToken: string): Promise<VerifiedIdentity | null> {
    try {
      const { data, error } = await this.getAuthClient().auth.getUser(accessToken);
      if (error || !data.user) return null;
      return { supabaseUserId: data.user.id, email: data.user.email ?? null };
    } catch {
      // Never log the token or error detail that could leak it.
      this.logger.warn("Access-token verification failed.");
      return null;
    }
  }

  /** Invite a user by email via Supabase admin. Returns the created auth user id. */
  async inviteByEmail(email: string, redirectTo?: string): Promise<{ supabaseUserId: string }> {
    const { data, error } = await this.getAdminClient().auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error || !data.user) {
      throw new Error(error?.message ?? "Supabase invitation failed.");
    }
    return { supabaseUserId: data.user.id };
  }
}
