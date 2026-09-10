import { describe, expect, it } from "vitest";
import { isRecoveryFragment } from "./auth-recovery";

describe("isRecoveryFragment", () => {
  it("recognises a real Supabase recovery fragment", () => {
    expect(
      isRecoveryFragment("#access_token=eyJhbGciOi.aaa.bbb&expires_in=3600&refresh_token=xyz&token_type=bearer&type=recovery"),
    ).toBe(true);
  });

  it("recognises it whatever order the parameters arrive in", () => {
    expect(isRecoveryFragment("#type=recovery&access_token=aaa")).toBe(true);
    expect(isRecoveryFragment("#access_token=aaa&type=recovery")).toBe(true);
    expect(isRecoveryFragment("#a=1&type=recovery&b=2")).toBe(true);
  });

  it("works with or without the leading hash", () => {
    expect(isRecoveryFragment("type=recovery")).toBe(true);
    expect(isRecoveryFragment("#type=recovery")).toBe(true);
  });

  // An invite must NOT be treated as a recovery: an invited user stays signed in
  // afterwards, while a recovery is signed out and asked to sign in again.
  it("does not match an invite or a magic link", () => {
    expect(isRecoveryFragment("#access_token=aaa&type=invite")).toBe(false);
    expect(isRecoveryFragment("#access_token=aaa&type=magiclink")).toBe(false);
    expect(isRecoveryFragment("#access_token=aaa&type=signup")).toBe(false);
    expect(isRecoveryFragment("#access_token=aaa&type=email_change")).toBe(false);
  });

  it("is anchored, so a longer value cannot match", () => {
    expect(isRecoveryFragment("#type=recovery_other")).toBe(false);
    expect(isRecoveryFragment("#some_type=recovery")).toBe(false);
    expect(isRecoveryFragment("#prefixtype=recovery")).toBe(false);
  });

  it("is false for an empty or missing fragment", () => {
    expect(isRecoveryFragment("")).toBe(false);
    expect(isRecoveryFragment("#")).toBe(false);
    expect(isRecoveryFragment(null)).toBe(false);
    expect(isRecoveryFragment(undefined)).toBe(false);
  });

  it("is false for the PKCE form, which the server callback handles instead", () => {
    // `?code=` arrives as a query parameter, never as a fragment, so nothing
    // here should claim it.
    expect(isRecoveryFragment("#")).toBe(false);
    expect(isRecoveryFragment("?code=abc&type=recovery")).toBe(false);
  });
});
