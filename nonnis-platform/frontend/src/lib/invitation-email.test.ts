import { describe, expect, it } from "vitest";
import { invitationEmailSentMessage } from "./invitation-email";

describe("invitationEmailSentMessage", () => {
  it("names an invitation as an invitation", () => {
    expect(invitationEmailSentMessage("INVITE", "new@example.com")).toBe("Invitation sent to new@example.com.");
  });

  it("says a password-setup link was sent instead, and why", () => {
    // Staff are the ones asked "what email should I be looking for?" — being
    // told only "sent" leaves them describing the wrong email.
    const message = invitationEmailSentMessage("PASSWORD_SETUP", "pending@example.com");
    expect(message).toContain("already registered");
    expect(message).toContain("set their password");
  });

  it("treats an unrecognized kind as an ordinary invitation", () => {
    // The server owns this vocabulary; an addition to it must not produce a
    // message claiming something specific and wrong.
    expect(invitationEmailSentMessage("SOMETHING_NEW", "a@b.com")).toBe("Invitation sent to a@b.com.");
  });
});
