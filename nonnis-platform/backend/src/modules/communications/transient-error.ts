import { Prisma } from "@prisma/client";

/**
 * Prisma error codes that mean "the database was not reachable right now",
 * as opposed to "this request was wrong".
 *
 * P2024 is the one that matters most in a serverless deployment: every instance
 * opens its own connection pool, so under concurrency a request can time out
 * waiting for a connection even though nothing is wrong with the data.
 */
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // cannot reach database server
  "P1002", // database server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
  "P2024", // timed out fetching a connection from the pool
  "P2028", // transaction API error / timeout
]);

/**
 * True when a failure is infrastructure-level and the same request would very
 * likely succeed on a retry.
 *
 * This distinction decides what a provider webhook answers. Acknowledging a
 * transient failure tells the provider the message was handled, and it is never
 * redelivered — a database blip silently destroys an inbound customer reply.
 * Answering 5xx instead lets the provider's own retry schedule recover it.
 */
export function isTransientInfrastructureError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_PRISMA_CODES.has(err.code);

  // Prisma sometimes surfaces pool exhaustion without a typed error class, and
  // undici/node network faults arrive as plain errors.
  const message = err instanceof Error ? err.message : "";
  return /connection pool|Timed out fetching|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message);
}
