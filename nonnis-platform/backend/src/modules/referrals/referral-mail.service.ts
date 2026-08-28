import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import type { AppConfig } from "../../config/configuration";
import { PrismaService } from "../../database/prisma.service";
import { ROLES } from "../../common/rbac";

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = "MAIL_TRANSPORT";

/** Default transport: nodemailer when SMTP is configured, otherwise throws
 *  ("not configured") — which the caller records as a FAILED notification. */
export function createDefaultMailTransport(config: ConfigService<AppConfig, true>): MailTransport {
  return {
    async send(message: MailMessage): Promise<void> {
      const host = config.get("smtpHost", { infer: true });
      const user = config.get("smtpUser", { infer: true });
      const pass = config.get("smtpPass", { infer: true });
      const from = config.get("mailFrom", { infer: true });
      if (!host || !user || !pass || !from) throw new Error("SMTP is not configured");
      const transporter = createTransport({
        host,
        port: config.get("smtpPort", { infer: true }),
        secure: config.get("smtpSecure", { infer: true }),
        auth: { user, pass },
      });
      await transporter.sendMail({ from, to: message.to.join(", "), subject: message.subject, text: message.text, html: message.html });
    },
  };
}

export interface ReferralNotificationInput {
  referralId: string;
  reference: string;
  providerId: string;
  serviceLabel?: string | null;
  facilityName?: string | null;
  responseDueAt?: Date | null;
}

export interface NotificationResult {
  status: "SENT" | "FAILED";
  error?: string;
  recipients: string[];
}

/**
 * Basic, manual transactional referral notification. Contains NO patient/clinical
 * detail — only the reference, a generic service label, the originating facility,
 * an optional due date, and a secure link back to the authenticated Provider
 * Portal. Never throws: delivery failure is returned as a FAILED status so the
 * referral record is preserved.
 */
@Injectable()
export class ReferralMailService {
  private readonly logger = new Logger(ReferralMailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  /** Active PROVIDER_ADMIN user emails in the provider's org, else the provider email. */
  async resolveRecipients(providerId: string): Promise<string[]> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { email: true, organizationId: true },
    });
    if (!provider) return [];
    const admins = await this.prisma.organizationMembership.findMany({
      where: { organizationId: provider.organizationId, status: "ACTIVE", role: { code: ROLES.PROVIDER_ADMIN } },
      select: { user: { select: { email: true, status: true } } },
    });
    const emails = admins
      .filter((a) => a.user.status === "ACTIVE" && a.user.email)
      .map((a) => a.user.email);
    if (emails.length > 0) return Array.from(new Set(emails));
    return provider.email ? [provider.email] : [];
  }

  async sendReferralNotification(input: ReferralNotificationInput): Promise<NotificationResult> {
    const recipients = await this.resolveRecipients(input.providerId);
    if (recipients.length === 0) {
      return { status: "FAILED", error: "No active provider recipient could be determined.", recipients: [] };
    }

    const base = (this.config.get("frontendUrl", { infer: true }) ?? "").replace(/\/$/, "");
    const link = `${base}/provider/referrals/${input.referralId}`;
    const due = input.responseDueAt ? `Please respond by ${input.responseDueAt.toISOString().slice(0, 10)}.` : "";
    const subject = `New referral ${input.reference} — Nonni's Placement`;
    const lines = [
      "A new referral is available for your organization.",
      `Reference: ${input.reference}`,
      input.serviceLabel ? `Service: ${input.serviceLabel}` : "",
      input.facilityName ? `From: ${input.facilityName}` : "",
      due,
      "",
      `Open it securely in your Provider Portal: ${link}`,
    ].filter(Boolean);
    const text = lines.join("\n");
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#472e16">
      <h2 style="color:#472e16">Nonni's Placement</h2>
      <p>A new referral is available for your organization.</p>
      <p><strong>Reference:</strong> ${input.reference}${input.serviceLabel ? `<br/><strong>Service:</strong> ${input.serviceLabel}` : ""}${input.facilityName ? `<br/><strong>From:</strong> ${input.facilityName}` : ""}</p>
      ${due ? `<p>${due}</p>` : ""}
      <p><a href="${link}" style="color:#b56f28">Open the referral in your Provider Portal</a></p>
      <p style="color:#6b7280;font-size:12px">For patient privacy, referral details are only available in the authenticated portal.</p>
    </div>`;

    try {
      await this.transport.send({ to: recipients, subject, text, html });
      return { status: "SENT", recipients };
    } catch (err) {
      this.logger.warn(`Referral notification failed for ${input.reference}: ${err instanceof Error ? err.message : "unknown error"}`);
      return { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 200) : "unknown error", recipients };
    }
  }
}
