import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { callbackDestination } from "@/lib/auth-recovery";

/**
 * Handles Supabase auth redirects (invite, password recovery, magic link).
 * Establishes the session cookie, then routes invited/recovering users to set a
 * password before continuing.
 *
 * Only the PKCE form reaches this route usefully: it arrives as `?code=`, which
 * is exchanged below. An invitation or a dashboard-sent link arrives in the
 * implicit form with its tokens in the URL **fragment**, which browsers never
 * transmit — so this handler sees no `code` and no `type` for those, and its
 * job reduces to handing the browser to a page that can read a fragment.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  // With a code, `type` says where to go: a password flow to the set-a-password
  // screen, anything else to `/home`, which dispatches by role.
  //
  // With NO code this is the implicit form, and the tokens are in a fragment
  // this handler cannot see. Sending it to `/home` put it behind middleware,
  // which cannot see the fragment either and bounced the visitor to `/login` —
  // where an invited user was shown a sign-in form and asked for a password
  // they had never set. `/auth/update-password` is a client page: it reads the
  // fragment, establishes the session, and shows a plain expired notice if
  // there was nothing to read after all.
  const destination = callbackDestination({ hasCode: !!code, type });
  const response = NextResponse.redirect(`${origin}${destination}`);

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
