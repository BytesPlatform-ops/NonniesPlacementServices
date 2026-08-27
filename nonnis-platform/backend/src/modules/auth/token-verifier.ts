/** A verified external identity (never trusted until signature-verified). */
export interface VerifiedIdentity {
  supabaseUserId: string;
  email: string | null;
}

/**
 * Abstraction over access-token verification so it can be mocked in tests
 * without contacting Supabase.
 */
export interface TokenVerifier {
  verify(accessToken: string): Promise<VerifiedIdentity | null>;
}

/** DI token for the TokenVerifier implementation. */
export const TOKEN_VERIFIER = "TOKEN_VERIFIER";
