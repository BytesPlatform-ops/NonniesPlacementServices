/**
 * Pure duplicate/conflict classification for imported contact rows against the
 * existing contact database. It NEVER merges two distinct people: an email that
 * matches contact A and a phone that matches a different contact B is a CONFLICT
 * requiring manual review, never an automatic merge.
 */

export interface ExistingLookup {
  /** normalizedEmail -> existing contactId */
  emailToContactId: Map<string, string>;
  /** normalizedPhoneE164 -> existing contactId */
  phoneToContactId: Map<string, string>;
}

export type ContactMatch =
  | { status: "NEW" }
  | { status: "DUPLICATE"; existingContactId: string }
  | { status: "CONFLICT"; emailContactId: string; phoneContactId: string };

export function classifyContactMatch(
  row: { normalizedEmail: string | null; normalizedPhoneE164: string | null },
  lookup: ExistingLookup,
): ContactMatch {
  const emailMatch = row.normalizedEmail ? lookup.emailToContactId.get(row.normalizedEmail) : undefined;
  const phoneMatch = row.normalizedPhoneE164 ? lookup.phoneToContactId.get(row.normalizedPhoneE164) : undefined;

  if (!emailMatch && !phoneMatch) return { status: "NEW" };

  if (emailMatch && phoneMatch) {
    if (emailMatch === phoneMatch) return { status: "DUPLICATE", existingContactId: emailMatch };
    // Two different existing people — never auto-merge.
    return { status: "CONFLICT", emailContactId: emailMatch, phoneContactId: phoneMatch };
  }

  return { status: "DUPLICATE", existingContactId: (emailMatch ?? phoneMatch)! };
}
