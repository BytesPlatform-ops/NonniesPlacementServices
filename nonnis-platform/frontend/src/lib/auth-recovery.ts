/**
 * Recognises the Supabase auth links that must land on the set-a-password
 * screen, and tells the two apart.
 *
 * Supabase delivers these two ways. A reset the CRM itself requests uses PKCE
 * and arrives as `?code=`, which `/auth/callback` exchanges server-side. An
 * invitation created by the backend, or a link sent from the Supabase
 * dashboard, instead arrives in the **implicit** form with its tokens in the
 * URL fragment — and a fragment is never transmitted to a server, so only the
 * browser can see it. These helpers are that browser-side detection.
 *
 * Kept pure so the matching is unit-tested rather than trusted. A false
 * negative is not a cosmetic bug: an invited user is dropped on the ordinary
 * sign-in form and asked for a password they have never set.
 */

/**
 * The `type` a Supabase auth fragment declares, or null when there is none.
 *
 * A query string is rejected outright: mistaking one for the other is the very
 * confusion this module exists to resolve, and `?code=…&type=invite` is the
 * PKCE form the server route already consumed.
 */
export function authFragmentType(hash: string | null | undefined): string | null {
  if (!hash || hash.startsWith("?")) return null;
  // The fragment carries its parameters in any order, so match by name rather
  // than position. `[^&]*` then bounds the value so `type=invite_other` is read
  // as its own distinct type instead of matching `invite`.
  const match = /(?:^|[#&])type=([^&]*)/.exec(hash);
  return match ? decodeURIComponent(match[1]!) : null;
}

/**
 * Flows whose whole purpose is to set a password, so the visitor must be taken
 * to `/auth/update-password` rather than shown a sign-in form.
 *
 * Deliberately only these two. A `magiclink` or `email_change` fragment also
 * carries a session, but neither is a request to choose a password, and
 * demanding one would interrupt a flow that was already complete.
 */
export function isPasswordSetupFragment(hash: string | null | undefined): boolean {
  const type = authFragmentType(hash);
  return type === "invite" || type === "recovery";
}

/**
 * A recovery specifically. The two diverge only *after* the password is saved:
 * a recovery signs the session out so the emailed link cannot be reused, while
 * an invited user stays signed in and continues into the app.
 */
export function isRecoveryFragment(hash: string | null | undefined): boolean {
  return authFragmentType(hash) === "recovery";
}

/**
 * Where `/auth/callback` should send the browser.
 *
 * Lives here rather than inside the route file because it is the same decision
 * the browser helpers above make, only from the server's narrower view — and a
 * Next route module may not export anything but its HTTP handlers, so a pure
 * function declared there could not be tested.
 *
 * With a code, the declared `type` decides. Without one this is the implicit
 * form and the tokens are in a fragment the server cannot see, so the only
 * useful move is to hand the browser to the client page that can read it.
 */
export function callbackDestination(input: { hasCode: boolean; type: string | null }): string {
  if (!input.hasCode) return "/auth/update-password";
  return input.type === "invite" || input.type === "recovery" ? "/auth/update-password" : "/home";
}
