import { InvitationEmailError, InvitationService } from "./invitation.service";
import type { PrismaService } from "../../database/prisma.service";
import type { SupabaseService } from "./supabase.service";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";
import type { BrevoEmailTransport } from "../communications/providers/brevo-email-transport";

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
  // Brevo not configured: the Supabase mailer path.
  const brevo = { configured: false, sendEmail: jest.fn() } as unknown as BrevoEmailTransport;
  return { svc: new InvitationService(prisma, supabase, config, brevo), supabase, updateMany };
}

const CONFIG: Record<string, string> = {
  frontendUrl: "https://admin.example.com",
  communicationsEmailProvider: "brevo",
  brevoSenderEmail: "admin@nonnisplacement.com",
  brevoSenderName: "Nonnis Placement",
};

function brevoHarness(over: { generate?: jest.Mock; send?: jest.Mock } = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const findUnique = jest.fn().mockResolvedValue({ firstName: "Jane" });
  const prisma = { user: { updateMany, findUnique } } as unknown as PrismaService;
  const generateAuthLink =
    over.generate ?? jest.fn().mockResolvedValue({ actionLink: "https://sb.example/verify?token=abc", supabaseUserId: "sb-1" });
  const supabase = {
    generateAuthLink,
    inviteByEmail: jest.fn(),
    sendPasswordSetupLink: jest.fn(),
  } as unknown as SupabaseService;
  const config = { get: jest.fn((key: string) => CONFIG[key]) } as unknown as ConfigService<AppConfig, true>;
  const sendEmail = over.send ?? jest.fn().mockResolvedValue({ ok: true, providerMessageId: "m-1", acceptedAt: "now" });
  const brevo = { configured: true, sendEmail } as unknown as BrevoEmailTransport;
  return { svc: new InvitationService(prisma, supabase, config, brevo), supabase, sendEmail, generateAuthLink, updateMany };
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

describe("InvitationService via Brevo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates the link with Supabase but sends the email through Brevo from the platform sender", async () => {
    const { svc, supabase, sendEmail, generateAuthLink, updateMany } = brevoHarness();

    await expect(svc.send("user-1", "new@example.com")).resolves.toBe("INVITE");

    expect(generateAuthLink).toHaveBeenCalledWith("invite", "new@example.com", "https://admin.example.com/auth/callback");
    expect(supabase.inviteByEmail).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", supabaseAuthUserId: null },
      data: { supabaseAuthUserId: "sb-1" },
    });
    const message = sendEmail.mock.calls[0][0];
    expect(message).toMatchObject({
      to: "new@example.com",
      senderEmail: "admin@nonnisplacement.com",
      senderName: "Nonnis Placement",
    });
    expect(message.html).toContain("https://sb.example/verify?token=abc");
    expect(message.text).toContain("Hi Jane,");
  });

  it("sends a password-setup link when the address is already registered", async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(new Error("A user with this email address has already been registered"))
      .mockResolvedValueOnce({ actionLink: "https://sb.example/verify?token=rec", supabaseUserId: "sb-1" });
    const { svc, sendEmail } = brevoHarness({ generate });

    await expect(svc.send("user-1", "pending@example.com")).resolves.toBe("PASSWORD_SETUP");

    expect(generate).toHaveBeenLastCalledWith("recovery", "pending@example.com", "https://admin.example.com/auth/callback");
    expect(sendEmail.mock.calls[0][0].text).toContain("https://sb.example/verify?token=rec");
  });

  it("reports a Brevo rate limit as such", async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, classification: "RATE_LIMIT", code: "RATE_LIMIT", message: "Rate limited." });
    const { svc } = brevoHarness({ send });

    await expect(svc.send("user-1", "new@example.com")).rejects.toMatchObject({ name: "InvitationEmailError", rateLimited: true });
  });

  it("surfaces any other Brevo failure as a non-rate-limited error", async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, classification: "PERMANENT", code: "AUTH", message: "Provider authentication/configuration failed." });
    const { svc } = brevoHarness({ send });

    await expect(svc.send("user-1", "new@example.com")).rejects.toMatchObject({ rateLimited: false });
  });
});
