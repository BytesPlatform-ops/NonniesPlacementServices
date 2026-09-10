/**
 * Recognises a Supabase password-recovery link that arrived in implicit form.
 *
 * Supabase sends recovery links two ways. A link requested by this app carries
 * `?code=` and is exchanged server-side by `/auth/callback`. A link sent without
 * a usable `redirectTo` — from the Supabase dashboard, for instance — instead
 * carries its tokens in the URL fragment and lands on the project's configured
 * Site URL. A fragment is never transmitted to the server, so only the browser
 * can detect that second form, and this is the check it uses.
 *
 * Kept as a pure function so the matching is unit-tested rather than trusted:
 * a false negative silently signs the visitor in without ever asking for a new
 * password, which is the exact failure this guards against.
 */
export function isRecoveryFragment(hash: string | null | undefined): boolean {
  if (!hash) return false;
  // A query string is not a fragment. Rejecting it outright matters because
  // mistaking one for the other is the very confusion this module exists to
  // resolve: `?code=…&type=recovery` is the PKCE form, which `/auth/callback`
  // handles server-side, and answering `true` for it here would send a visitor
  // down the browser path for a link the server has already consumed.
  if (hash.startsWith("?")) return false;
  // The fragment is `#access_token=…&type=recovery&…` in any order, so match the
  // parameter rather than a fixed position. Anchored on a delimiter so a value
  // like `type=recovery_other` cannot match.
  return /(^|[#&])type=recovery(&|$)/.test(hash);
}
