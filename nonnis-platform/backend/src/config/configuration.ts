/**
 * Centralized, typed environment configuration. Loaded once via @nestjs/config.
 * Validation is intentionally non-throwing so the app can build and be tested
 * without a database; missing critical values are surfaced as warnings and
 * fail loudly only when a real database operation is attempted.
 */
export interface AppConfig {
  port: number;
  frontendUrl: string;
  databaseUrl: string | undefined;
  nodeEnv: string;
}

export function loadConfiguration(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);

  return {
    port: Number.isNaN(port) ? 4000 : port,
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
