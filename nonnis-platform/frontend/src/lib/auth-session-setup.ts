/**
 * Establishes the Supabase session that a password-setup link carries.
 *
 * WHY THIS EXISTS
 *
 * `@supabase/ssr`'s `createBrowserClient` pins `flowType: "pkce"`, and auth-js
 * then refuses an implicit callback outright — `_getSessionFromURL` throws
 * "Not a valid PKCE flow url." the moment it sees an `access_token` in the URL
 * while the client is in pkce mode. Supabase's own admin invitations are
 * implicit, so `detectSessionInUrl` never establishes a session for them
 * however valid and fresh the tokens are. The page was left with no session,
 * and reported the link as expired.
 *
 * `setSession` has no such flow check: it takes the token pair directly. So the
 * tokens are parsed from the fragment and handed to it explicitly rather than
 * hoping the client picks them up.
 *
 * Kept pure — the client arrives as an argument — so the whole sequence is
 * unit-tested against a stubbed client instead of inferred from behaviour.
 *
 * No token is logged, returned, or put in an error. The result says only what
 * happened and which flow it was.
 */

export type SetupFlow = "invite" | "recovery";

export type SetupOutcome =
  | { status: "ready"; flow: SetupFlow; fragmentConsumed: boolean }
  | { status: "invalid" };

/** The subset of the Supabase auth client this needs. */
export interface SessionClient {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{
    data: { session: unknown | null };
    error: unknown | null;
  }>;
  getSession(): Promise<{ data: { session: unknown | null } }>;
}

export interface AuthFragment {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Pulls the auth parameters out of a URL fragment.
 *
 * A leading `?` is rejected: that is a query string, which the server route
 * consumes, and reading one here would mean acting on a flow already handled.
 */
export function parseAuthFragment(hash: string | null | undefined): AuthFragment {
  const empty: AuthFragment = { type: null, accessToken: null, refreshToken: null };
  if (!hash || hash.startsWith("?")) return empty;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return {
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

const asFlow = (type: string | null): SetupFlow | null =>
  type === "invite" || type === "recovery" ? type : null;

/**
 * Gets the visitor to a state where they can set a password, or reports that
 * the link cannot be used.
 *
 * Two paths reach here and both are handled explicitly rather than by waiting
 * to see whether a session appears:
 *
 *  - **Implicit** (an invitation, or a link sent from the Supabase dashboard):
 *    the tokens are in the fragment, and `setSession` is called with them.
 *  - **PKCE** (a reset this app requested): `/auth/callback` already exchanged
 *    the code and set the session cookie, so there is nothing in the URL and
 *    the existing session is simply confirmed. `flowParam` carries the type
 *    across that redirect, since the fragment the implicit path relies on does
 *    not exist here.
 *
 * `fragmentConsumed` tells the caller it now owns clearing the URL — and only
 * on success, so a failed attempt leaves the tokens available for a retry
 * rather than destroying them.
 */
export async function establishPasswordSetupSession(
  client: SessionClient,
  input: { hash: string | null | undefined; flowParam?: string | null },
): Promise<SetupOutcome> {
  const fragment = parseAuthFragment(input.hash);
  const fragmentFlow = asFlow(fragment.type);

  if (fragmentFlow) {
    // Both halves are required. `setSession` rejects a partial pair anyway;
    // checking first means a malformed link is reported without a round trip.
    if (!fragment.accessToken || !fragment.refreshToken) return { status: "invalid" };

    try {
      const { data, error } = await client.setSession({
        access_token: fragment.accessToken,
        refresh_token: fragment.refreshToken,
      });
      if (error || !data.session) return { status: "invalid" };
      return { status: "ready", flow: fragmentFlow, fragmentConsumed: true };
    } catch {
      // The thrown error can carry the token in its message, so it is
      // deliberately not read, logged, or surfaced.
      return { status: "invalid" };
    }
  }

  // A fragment that declares some other type (a magic link, say) is not a
  // request to set a password. The caller sends those on rather than
  // interrupting a flow that already completed.
  if (fragment.type) return { status: "invalid" };

  // No fragment: the PKCE path, where the session is already a cookie.
  try {
    const { data } = await client.getSession();
    if (!data.session) return { status: "invalid" };
    // Default to invite when the type did not survive the redirect: it is the
    // gentler of the two, since it keeps the user signed in rather than
    // signing them out and asking them to sign in again.
    return { status: "ready", flow: asFlow(input.flowParam ?? null) ?? "invite", fragmentConsumed: false };
  } catch {
    return { status: "invalid" };
  }
}
