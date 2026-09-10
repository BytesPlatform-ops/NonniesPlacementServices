/**
 * What to tell staff after an invitation email has gone out.
 *
 * The two emails the platform can send are not interchangeable from the
 * recipient's side: one says "you have been invited", the other says "set your
 * password". An address that was invited once and never accepted is already
 * registered, so a resend has to be the second kind — and whoever pressed the
 * button is the person who will be asked what to look for in the inbox. So the
 * message names which arrived instead of only saying it was sent.
 */
export function invitationEmailSentMessage(emailKind: string, email: string): string {
  return emailKind === "PASSWORD_SETUP"
    ? `${email} is already registered, so a link to set their password was sent instead of a new invitation.`
    : `Invitation sent to ${email}.`;
}
