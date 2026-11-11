import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import type { AppConfig } from "../../config/configuration";
import { BrevoEmailTransport } from "../communications/providers/brevo-email-transport";
import { resolveSender } from "../communications/email/email-config";
import { buildInvitationEmail } from "./invitation-email";
import { SupabaseService } from "./supabase.service";

/** Which email the recipient will actually find in their inbox. */
export type InvitationEmailKind = "INVITE" | "PASSWORD_SETUP";

/**
 * An invitation email that was not sent, carrying enough for the caller to tell
 * its own user what to do next. `reason` comes from the auth provider and holds
 * no token or credential.
 */
export class InvitationEmailError extends Error {
  constructor(
    readonly reason: string,
    readonly rateLimited: boolean,
  ) {
    super(reason);
    this.name = "InvitationEmailError";
  }
}

const ALREADY_REGISTERED = /already\s+(been\s+)?registered/i;
const RATE_LIMITED = /rate limit/i;

/**
 * Sends the email that lets a pending user set a password and sign in — for
 * both invitations the platform issues: joining an organization, and a family
 * member's access to one case.
 *
 * One service because the rule it encodes is subtle and identical for both.
 * `inviteUserByEmail` refuses an address that is already registered, which is
 * exactly the state of every invitation that was sent once and never accepted;
 * a resend therefore has to fall back to a fresh password-setup link instead of
 * reporting failure. Both emails land on the same `/auth/callback`, and the
 * set-a-password screen already treats an invite and a recovery fragment as one
 * flow, so the recipient sees the same thing either way.
 *
 * Delivery: when Brevo is the configured email provider, Supabase only creates
 * the link and the email itself goes out through Brevo, from the platform's own
 * verified sender. Supabase's built-in mailer allows only a couple of emails an
 * hour and uses a generic sender, which is why invites stopped after two sends
 * and landed in Promotions. Without Brevo (development, mock mode) the
 * Supabase mailer is still used, so nothing changes there.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly brevo: BrevoEmailTransport,
  ) {}

  /** True when invitation emails go out through Brevo rather than Supabase. */
  private get viaBrevo(): boolean {
    return this.config.get("communicationsEmailProvider", { infer: true }) === "brevo" && this.brevo.configured;
  }

  /**
   * Invites `email`, or sends a password-setup link when the address is already
   * registered. Returns which of the two went out.
   *
   * @throws InvitationEmailError when no email could be sent at all.
   */
  async send(userId: string, email: string): Promise<InvitationEmailKind> {
    const redirectTo = `${this.config.get("frontendUrl", { infer: true })}/auth/callback`;
    if (this.viaBrevo) return this.sendViaBrevo(userId, email, redirectTo);

    try {
      const { supabaseUserId } = await this.supabase.inviteByEmail(email, redirectTo);
      // Fills a gap only: an identity that is already linked is never replaced.
      await this.prisma.user.updateMany({
        where: { id: userId, supabaseAuthUserId: null },
        data: { supabaseAuthUserId: supabaseUserId },
      });
      return "INVITE";
    } catch (error) {
      const reason = InvitationService.reasonOf(error);
      if (!ALREADY_REGISTERED.test(reason)) {
        this.logger.warn(`Invitation email for user ${userId} was not sent: ${reason}`);
        throw new InvitationEmailError(reason, RATE_LIMITED.test(reason));
      }

      // The address belongs to an identity that already exists, so what it
      // needs is a new link for setting a password, not a second invitation.
      // The identity id stays unlinked here; the first sign-in matches on email
      // and links it then, exactly as it does for any other pending user.
      try {
        await this.supabase.sendPasswordSetupLink(email, redirectTo);
        return "PASSWORD_SETUP";
      } catch (fallbackError) {
        const fallbackReason = InvitationService.reasonOf(fallbackError);
        this.logger.warn(`Password-setup email for user ${userId} was not sent: ${fallbackReason}`);
        throw new InvitationEmailError(fallbackReason, RATE_LIMITED.test(fallbackReason));
      }
    }
  }

  /** Same rule as `send`, with Supabase creating the link and Brevo delivering it. */
  private async sendViaBrevo(userId: string, email: string, redirectTo: string): Promise<InvitationEmailKind> {
    let kind: InvitationEmailKind = "INVITE";
    let link: string;
    try {
      const generated = await this.supabase.generateAuthLink("invite", email, redirectTo);
      link = generated.actionLink;
      if (generated.supabaseUserId) {
        // Fills a gap only: an identity that is already linked is never replaced.
        await this.prisma.user.updateMany({
          where: { id: userId, supabaseAuthUserId: null },
          data: { supabaseAuthUserId: generated.supabaseUserId },
        });
      }
    } catch (error) {
      const reason = InvitationService.reasonOf(error);
      if (!ALREADY_REGISTERED.test(reason)) {
        this.logger.warn(`Invitation link for user ${userId} could not be created: ${reason}`);
        throw new InvitationEmailError(reason, RATE_LIMITED.test(reason));
      }
      try {
        link = (await this.supabase.generateAuthLink("recovery", email, redirectTo)).actionLink;
        kind = "PASSWORD_SETUP";
      } catch (fallbackError) {
        const fallbackReason = InvitationService.reasonOf(fallbackError);
        this.logger.warn(`Password-setup link for user ${userId} could not be created: ${fallbackReason}`);
        throw new InvitationEmailError(fallbackReason, RATE_LIMITED.test(fallbackReason));
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const sender = resolveSender(this.config);
    const content = buildInvitationEmail({ variant: kind, link, firstName: user?.firstName ?? null, senderName: sender.name });
    const outcome = await this.brevo.sendEmail({
      to: email,
      senderEmail: sender.email,
      senderName: sender.name,
      replyTo: sender.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      internalMessageId: randomUUID(),
      tags: ["invitation"],
    });
    if (!outcome.ok) {
      // Never log the link: it is a sign-in credential.
      this.logger.warn(`Invitation email for user ${userId} was not sent via Brevo: ${outcome.code}`);
      throw new InvitationEmailError(outcome.message, outcome.classification === "RATE_LIMIT");
    }
    return kind;
  }

  private static reasonOf(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error";
  }
}
