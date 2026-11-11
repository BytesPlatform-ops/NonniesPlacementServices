/**
 * The invitation / password-setup email the platform sends itself (through
 * Brevo) instead of Supabase's default mailer.
 *
 * Deliberately plain and personal in style: no images, no banner, no
 * marketing layout, a single link. That is what gives a one-to-one email the
 * best chance of landing in Gmail's Primary tab rather than Promotions.
 */

export type InvitationEmailVariant = "INVITE" | "PASSWORD_SETUP";

export interface InvitationEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildInvitationEmail(input: {
  variant: InvitationEmailVariant;
  link: string;
  firstName: string | null;
  senderName: string;
}): InvitationEmailContent {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hello,";
  const invite = input.variant === "INVITE";

  const subject = invite ? "Your invitation to Nonni's Placement" : "Set your Nonni's Placement password";
  const intro = invite
    ? "You've been invited to the Nonni's Placement platform. To accept, set a password using the link below, and you'll be signed straight in."
    : "Here is a new link to set your password for the Nonni's Placement platform. Once it's set you'll be signed straight in.";
  const action = invite ? "Accept the invitation and set your password" : "Set your password";
  const outro = "The link works once and expires after a while. If it has expired, or you weren't expecting this email, just reply and let us know.";

  const text = [greeting, "", intro, "", `${action}:`, input.link, "", outro, "", "Thanks,", input.senderName].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;">
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(intro)}</p>
    <p><a href="${escapeHtml(input.link)}">${escapeHtml(action)}</a></p>
    <p style="color:#555;">${escapeHtml(outro)}</p>
    <p>Thanks,<br>${escapeHtml(input.senderName)}</p>
  </body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
