/**
 * Centralized, typed environment configuration. Loaded once via @nestjs/config.
 * Validation is intentionally non-throwing so the app can build and be tested
 * without external services; missing critical values are surfaced as warnings
 * and fail loudly only when the dependent operation is attempted.
 *
 * SECURITY: the Supabase service-role key is a backend-only secret. It is never
 * exposed to the frontend and never logged.
 */
export interface AppConfig {
  port: number;
  frontendUrl: string;
  databaseUrl: string | undefined;
  nodeEnv: string;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  /** Shared secret for the server-to-server website form ingestion endpoint. */
  formIngestToken: string | undefined;
}

export function loadConfiguration(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);

  return {
    port: Number.isNaN(port) ? 4000 : port,
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV ?? "development",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    formIngestToken: process.env.FORM_INGEST_TOKEN,
  };
}
