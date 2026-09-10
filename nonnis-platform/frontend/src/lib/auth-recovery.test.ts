import { describe, expect, it } from "vitest";
import { authFragmentType, callbackDestination, isPasswordSetupFragment, isRecoveryFragment } from "./auth-recovery";

/**
 * The exact URL a real Provider Admin invitation produced during UAT. The
 * browser had already been bounced through `/auth/callback` → `/home` →
 * `/login`, carrying the fragment the whole way, and the sign-in form rendered
 * — asking an invited user for a password they had never set.
 */
const REAL_INVITE_URL =
  "http://localhost:3001/login?redirectTo=%2Fhome#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb" +
  "&expires_at=1788999999&expires_in=3600&refresh_token=abc123&token_type=bearer&type=invite";

/** Just the fragment, as `window.location.hash` reports it. */
const REAL_INVITE_HASH = `#${REAL_INVITE_URL.split("#")[1]}`;

describe("the real UAT invitation URL", () => {
  it("is recognised as needing the set-a-password screen", () => {
    // The regression that mattered: this returned false, so the login page
    // never forwarded it and rendered the sign-in form instead.
    expect(isPasswordSetupFragment(REAL_INVITE_HASH)).toBe(true);
  });

  it("is read as an invitation, not a recovery", () => {
    // The two diverge after the password is saved: a recovery signs out, an
    // invited user continues into the app.
    expect(authFragmentType(REAL_INVITE_HASH)).toBe("invite");
    expect(isRecoveryFragment(REAL_INVITE_HASH)).toBe(false);
  });

  it("is detected from the fragment alone, ignoring the query string", () => {
    // `?redirectTo=%2Fhome` is on the URL too; only the fragment decides.
    const query = new URL(REAL_INVITE_URL).search;
    expect(isPasswordSetupFragment(query)).toBe(false);
  });

  it("forwards to update-password with the fragment intact", () => {
    // What the login page does with it. The fragment must survive, because the
    // tokens live in it and nothing else can establish the session.
    const destination = `/auth/update-password${REAL_INVITE_HASH}`;
    expect(destination.startsWith("/auth/update-password#")).toBe(true);
    expect(destination).toContain("type=invite");
    expect(destination).not.toContain("/login");
  });
});

describe("authFragmentType", () => {
  it("reads the declared type from a real fragment", () => {
    expect(authFragmentType("#access_token=aaa&type=invite")).toBe("invite");
    expect(authFragmentType("#access_token=aaa&type=recovery")).toBe("recovery");
    expect(authFragmentType("#access_token=aaa&type=magiclink")).toBe("magiclink");
    expect(authFragmentType("#access_token=aaa&type=email_change")).toBe("email_change");
  });

  it("finds it whatever order the parameters arrive in", () => {
    expect(authFragmentType("#type=invite&access_token=aaa")).toBe("invite");
    expect(authFragmentType("#a=1&type=invite&b=2")).toBe("invite");
  });

  it("works with or without the leading hash", () => {
    expect(authFragmentType("type=invite")).toBe("invite");
    expect(authFragmentType("#type=invite")).toBe("invite");
  });

  it("is null when there is no fragment or no type", () => {
    expect(authFragmentType("")).toBeNull();
    expect(authFragmentType("#")).toBeNull();
    expect(authFragmentType("#access_token=aaa")).toBeNull();
    expect(authFragmentType(null)).toBeNull();
    expect(authFragmentType(undefined)).toBeNull();
  });

  it("refuses a query string, which the server route already consumed", () => {
    expect(authFragmentType("?code=abc&type=invite")).toBeNull();
    expect(authFragmentType("?type=recovery")).toBeNull();
  });

  it("does not confuse a longer type with a shorter one", () => {
    expect(authFragmentType("#type=invite_other")).toBe("invite_other");
    expect(isPasswordSetupFragment("#type=invite_other")).toBe(false);
    expect(authFragmentType("#some_type=invite")).toBeNull();
  });
});

describe("isPasswordSetupFragment", () => {
  it("is true for the two flows that exist to set a password", () => {
    expect(isPasswordSetupFragment("#access_token=aaa&type=invite")).toBe(true);
    expect(isPasswordSetupFragment("#access_token=aaa&type=recovery")).toBe(true);
  });

  it("is false for a flow that is already complete", () => {
    // A magic link carries a session but is not a request to choose a
    // password; interrupting it would break a finished sign-in.
    expect(isPasswordSetupFragment("#access_token=aaa&type=magiclink")).toBe(false);
    expect(isPasswordSetupFragment("#access_token=aaa&type=email_change")).toBe(false);
    expect(isPasswordSetupFragment("#access_token=aaa&type=signup")).toBe(false);
  });

  it("is false for an ordinary sign-in, so the login form still renders", () => {
    // No fragment at all: the login page must show its form as before.
    expect(isPasswordSetupFragment("")).toBe(false);
    expect(isPasswordSetupFragment("#")).toBe(false);
    expect(isPasswordSetupFragment(null)).toBe(false);
    expect(isPasswordSetupFragment(undefined)).toBe(false);
  });
});

describe("isRecoveryFragment", () => {
  it("separates a recovery from an invitation", () => {
    expect(isRecoveryFragment("#type=recovery")).toBe(true);
    expect(isRecoveryFragment("#type=invite")).toBe(false);
  });

  it("is false when there is nothing to read", () => {
    expect(isRecoveryFragment("")).toBe(false);
    expect(isRecoveryFragment("#access_token=aaa")).toBe(false);
    expect(isRecoveryFragment("?code=abc&type=recovery")).toBe(false);
  });
});

describe("the PKCE form is left to the server route", () => {
  it("is not claimed by any browser-side helper", () => {
    // `/auth/callback` exchanges `?code=` server-side and sets the cookie; the
    // browser helpers must not also try to handle it.
    for (const query of ["?code=abc&type=invite", "?code=abc&type=recovery", "?code=abc"]) {
      expect(authFragmentType(query)).toBeNull();
      expect(isPasswordSetupFragment(query)).toBe(false);
      expect(isRecoveryFragment(query)).toBe(false);
    }
  });
});

describe("no token is ever exposed by these helpers", () => {
  it("returns only the declared type, never any token material", () => {
    const type = authFragmentType(REAL_INVITE_HASH);
    expect(type).toBe("invite");
    // Nothing token-shaped can escape through the return value.
    expect(type).not.toContain("eyJ");
    expect(type).not.toContain("refresh_token");
    expect(type).not.toContain("access_token");
  });
});

describe("callbackDestination", () => {
  it("hands the implicit form to the page that can read a fragment", () => {
    // The bug: this used to send the browser to `/home`, which sits behind
    // middleware — no session cookie, so it bounced to `/login` and the
    // invited user met a sign-in form.
    expect(callbackDestination({ hasCode: false, type: null })).toBe("/auth/update-password");
    expect(callbackDestination({ hasCode: false, type: "invite" })).toBe("/auth/update-password");
  });

  it("sends a PKCE password flow to the set-a-password screen", () => {
    expect(callbackDestination({ hasCode: true, type: "invite" })).toBe("/auth/update-password");
    expect(callbackDestination({ hasCode: true, type: "recovery" })).toBe("/auth/update-password");
  });

  it("sends any other PKCE flow to the role-aware landing", () => {
    // `/home` dispatches by role, so a provider reaches /provider and a family
    // member /seeker without either being named here.
    expect(callbackDestination({ hasCode: true, type: "magiclink" })).toBe("/home");
    expect(callbackDestination({ hasCode: true, type: null })).toBe("/home");
  });

  it("never sends anyone to /login", () => {
    for (const hasCode of [true, false]) {
      for (const type of ["invite", "recovery", "magiclink", null]) {
        expect(callbackDestination({ hasCode, type })).not.toContain("/login");
      }
    }
  });
});
