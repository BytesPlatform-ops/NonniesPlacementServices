import { describe, expect, it, vi } from "vitest";
import { establishPasswordSetupSession, parseAuthFragment, type SessionClient } from "./auth-session-setup";

/**
 * The fragment a real Provider Admin invitation delivered during UAT — a fresh
 * link on its first click. `detectSessionInUrl` silently refused it because
 * `createBrowserClient` pins `flowType: "pkce"` and auth-js rejects an implicit
 * callback in that mode, so no session was ever created and the page reported
 * the link as expired.
 *
 * The token values here are obvious placeholders; no real token appears in any
 * test.
 */
const INVITE_HASH =
  "#access_token=fake-access&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=invite";

const RECOVERY_HASH =
  "#access_token=fake-access&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=recovery";

/** A client whose `setSession` succeeds, as it does for a valid token pair. */
function workingClient() {
  const setSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
  const getSession = vi.fn().mockResolvedValue({ data: { session: null } });
  return { client: { setSession, getSession } as unknown as SessionClient, setSession, getSession };
}

describe("the real fresh-invitation fragment", () => {
  it("establishes the session with the exact token pair from the fragment", async () => {
    const { client, setSession } = workingClient();

    const outcome = await establishPasswordSetupSession(client, { hash: INVITE_HASH });

    // The fix: the tokens are handed over explicitly rather than left to a
    // client that will not read them.
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith({
      access_token: "fake-access",
      refresh_token: "fake-refresh",
    });
    expect(outcome).toEqual({ status: "ready", flow: "invite", fragmentConsumed: true });
  });

  it("does not report the link as invalid", async () => {
    const { client } = workingClient();
    const outcome = await establishPasswordSetupSession(client, { hash: INVITE_HASH });
    // The exact symptom: "This link is no longer valid" on a fresh first click.
    expect(outcome.status).not.toBe("invalid");
  });

  it("is read as an invitation, so the user stays signed in afterwards", async () => {
    const { client } = workingClient();
    const outcome = await establishPasswordSetupSession(client, { hash: INVITE_HASH });
    expect(outcome.status === "ready" && outcome.flow).toBe("invite");
  });

  it("tells the caller to clear the URL, which it may only do on success", async () => {
    const { client } = workingClient();
    const ok = await establishPasswordSetupSession(client, { hash: INVITE_HASH });
    expect(ok.status === "ready" && ok.fragmentConsumed).toBe(true);

    // On failure the tokens are left in place — clearing them would destroy the
    // only copy and make a retry impossible.
    const failing = {
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "bad" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    } as unknown as SessionClient;
    expect(await establishPasswordSetupSession(failing, { hash: INVITE_HASH })).toEqual({ status: "invalid" });
  });

  it("never consults getSession for the implicit path", async () => {
    // Asking first was the old failure mode: there is no session yet, and the
    // answer was mistaken for an expired link.
    const { client, getSession } = workingClient();
    await establishPasswordSetupSession(client, { hash: INVITE_HASH });
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe("genuine failures still report an invalid link", () => {
  const cases: Array<[string, string]> = [
    ["missing refresh token", "#access_token=fake-access&type=invite"],
    ["missing access token", "#refresh_token=fake-refresh&type=invite"],
    ["neither token", "#type=invite"],
    ["malformed fragment", "#not-even=key-value-pairs"],
    ["empty fragment", "#"],
  ];

  it.each(cases)("%s", async (_label, hash) => {
    const { client } = workingClient();
    const outcome = await establishPasswordSetupSession(client, { hash });
    expect(outcome.status).toBe("invalid");
  });

  it("a rejected token pair — expired, reused, or tampered with", async () => {
    const client = {
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "invalid claim" } }),
      getSession: vi.fn(),
    } as unknown as SessionClient;
    expect(await establishPasswordSetupSession(client, { hash: INVITE_HASH })).toEqual({ status: "invalid" });
  });

  it("a client that throws rather than returning an error", async () => {
    // The thrown error can quote the token, so it is never read or surfaced.
    const client = {
      setSession: vi.fn().mockRejectedValue(new Error("boom: fake-access")),
      getSession: vi.fn(),
    } as unknown as SessionClient;
    expect(await establishPasswordSetupSession(client, { hash: INVITE_HASH })).toEqual({ status: "invalid" });
  });

  it("no fragment and no existing session", async () => {
    const { client } = workingClient();
    expect(await establishPasswordSetupSession(client, { hash: "" })).toEqual({ status: "invalid" });
  });
});

describe("the recovery flow is unchanged", () => {
  it("establishes an implicit recovery session and reports it as a recovery", async () => {
    const { client, setSession } = workingClient();
    const outcome = await establishPasswordSetupSession(client, { hash: RECOVERY_HASH });
    expect(setSession).toHaveBeenCalledWith({ access_token: "fake-access", refresh_token: "fake-refresh" });
    // The flow matters: a recovery signs out afterwards, an invitation does not.
    expect(outcome).toEqual({ status: "ready", flow: "recovery", fragmentConsumed: true });
  });

  it("confirms an existing PKCE session and takes the flow from the query", async () => {
    // `/auth/callback` exchanged the code and set the cookie, so there is no
    // fragment; `?flow=` carries the type across that redirect.
    const client = {
      setSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    } as unknown as SessionClient;

    const outcome = await establishPasswordSetupSession(client, { hash: "", flowParam: "recovery" });
    expect(outcome).toEqual({ status: "ready", flow: "recovery", fragmentConsumed: false });
    expect(client.setSession).not.toHaveBeenCalled();
  });

  it("treats a PKCE invitation as an invitation", async () => {
    const client = {
      setSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    } as unknown as SessionClient;
    const outcome = await establishPasswordSetupSession(client, { hash: "", flowParam: "invite" });
    expect(outcome).toEqual({ status: "ready", flow: "invite", fragmentConsumed: false });
  });

  it("defaults a PKCE session with no type to the gentler flow", async () => {
    // Invite keeps the user signed in; guessing recovery would sign someone out
    // for no reason.
    const client = {
      setSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    } as unknown as SessionClient;
    const outcome = await establishPasswordSetupSession(client, { hash: "" });
    expect(outcome.status === "ready" && outcome.flow).toBe("invite");
  });
});

describe("flows that are not password setup", () => {
  it("reports a magic link as not-for-this-page rather than establishing it here", async () => {
    // The page sends these on to /home instead of demanding a password.
    const { client, setSession } = workingClient();
    const outcome = await establishPasswordSetupSession(client, {
      hash: "#access_token=fake-access&refresh_token=fake-refresh&type=magiclink",
    });
    expect(outcome).toEqual({ status: "invalid" });
    expect(setSession).not.toHaveBeenCalled();
  });

  it("ignores a query string, which the server route already consumed", async () => {
    const { client, setSession } = workingClient();
    const outcome = await establishPasswordSetupSession(client, { hash: "?code=abc&type=invite" });
    // Falls through to the existing-session check, which finds none here.
    expect(outcome).toEqual({ status: "invalid" });
    expect(setSession).not.toHaveBeenCalled();
  });
});

describe("repeated effect runs do not spoil a good session", () => {
  it("a second attempt after the URL was cleared confirms the session instead", async () => {
    // React runs effects twice in development. The first run establishes the
    // session and clears the fragment; the second finds no fragment and must
    // confirm what already exists rather than declaring the link invalid.
    const client = {
      setSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    } as unknown as SessionClient;

    const first = await establishPasswordSetupSession(client, { hash: INVITE_HASH });
    expect(first.status).toBe("ready");

    const second = await establishPasswordSetupSession(client, { hash: "", flowParam: "invite" });
    expect(second).toEqual({ status: "ready", flow: "invite", fragmentConsumed: false });
  });
});

describe("parseAuthFragment", () => {
  it("reads all three parameters in any order", () => {
    expect(parseAuthFragment(INVITE_HASH)).toEqual({
      type: "invite",
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
    });
    expect(parseAuthFragment("#type=recovery&refresh_token=r&access_token=a")).toEqual({
      type: "recovery",
      accessToken: "a",
      refreshToken: "r",
    });
  });

  it("returns nulls for anything that is not an auth fragment", () => {
    for (const input of ["", "#", null, undefined, "?code=abc&type=invite"]) {
      expect(parseAuthFragment(input)).toEqual({ type: null, accessToken: null, refreshToken: null });
    }
  });

  it("decodes percent-encoded values", () => {
    expect(parseAuthFragment("#access_token=a%2Bb&refresh_token=r&type=invite").accessToken).toBe("a+b");
  });
});
