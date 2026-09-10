import { InvitationEmailError, InvitationService } from "./invitation.service";
import type { PrismaService } from "../../database/prisma.service";
import type { SupabaseService } from "./supabase.service";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";

function harness(over: Partial<Record<"invite" | "setup", jest.Mock>> = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = { user: { updateMany } } as unknown as PrismaService;
  const supabase = {
    inviteByEmail: over.invite ?? jest.fn().mockResolvedValue({ supabaseUserId: "sb-1" }),
    sendPasswordSetupLink: over.setup ?? jest.fn().mockResolvedValue(undefined),
  } as unknown as SupabaseService;
  const config = { get: jest.fn().mockReturnValue("https://admin.example.com") } as unknown as ConfigService<
    AppConfig,
    true
  >;
  return { svc: new InvitationService(prisma, supabase, config), supabase, updateMany };
}

const alreadyRegistered = () =>
  jest.fn().mockRejectedValue(new Error("A user with this email address has already been registered"));

describe("InvitationService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invites an unknown address and links the identity it creates", async () => {
    const { svc, supabase, updateMany } = harness();

    await expect(svc.send("user-1", "new@example.com")).resolves.toBe("INVITE");

    expect(supabase.inviteByEmail).toHaveBeenCalledWith("new@example.com", "https://admin.example.com/auth/callback");
    // Only fills a gap — an identity already linked is never replaced.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", supabaseAuthUserId: null },
      data: { supabaseAuthUserId: "sb-1" },
    });
  });

  it("sends a password-setup link when the address is already registered", async () => {
    // This is the state of every invitation that was sent once and ignored, so
    // without the fallback a resend could never succeed.
    const { svc, supabase } = harness({ invite: alreadyRegistered() });

    await expect(svc.send("user-1", "pending@example.com")).resolves.toBe("PASSWORD_SETUP");

    expect(supabase.sendPasswordSetupLink).toHaveBeenCalledWith(
      "pending@example.com",
      "https://admin.example.com/auth/callback",
    );
  });

  it("marks a send-rate limit as such, so the caller can say to wait", async () => {
    const invite = jest.fn().mockRejectedValue(new Error("429: email rate limit exceeded"));
    const { svc, supabase } = harness({ invite });

    await expect(svc.send("user-1", "new@example.com")).rejects.toMatchObject({
      name: "InvitationEmailError",
      rateLimited: true,
    });
    // A rate limit is not an already-registered address: no second email is attempted.
    expect(supabase.sendPasswordSetupLink).not.toHaveBeenCalled();
  });

  it("reports a rate limit hit by the fallback too", async () => {
    const { svc } = harness({
      invite: alreadyRegistered(),
      setup: jest.fn().mockRejectedValue(new Error("429: email rate limit exceeded")),
    });

    await expect(svc.send("user-1", "pending@example.com")).rejects.toMatchObject({ rateLimited: true });
  });

  it("surfaces an ordinary failure as a non-rate-limited error", async () => {
    const { svc } = harness({ invite: jest.fn().mockRejectedValue(new Error("smtp unreachable")) });

    const error = await svc.send("user-1", "new@example.com").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvitationEmailError);
    expect((error as InvitationEmailError).rateLimited).toBe(false);
  });

  it("never links an identity when nothing was created", async () => {
    const { svc, updateMany } = harness({ invite: alreadyRegistered() });

    await svc.send("user-1", "pending@example.com");

    expect(updateMany).not.toHaveBeenCalled();
  });
});
