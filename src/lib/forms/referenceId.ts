import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Build a unique, human-readable submission reference ID, e.g. `HR-20260818-A3F9C1`.
 * The prefix encodes the form type so records file cleanly; the date aids sorting;
 * the random suffix guarantees uniqueness.
 */

const PREFIXES: Record<string, string> = {
  "hospital referral": "HR",
  "provider form": "PR",
  "find community": "FC", // Family / client
  "care profile": "CP",
};

function prefixFor(formName: string): string {
  return PREFIXES[formName.trim().toLowerCase()] ?? "NPS";
}

export function makeReferenceId(formName: string, when: Date = new Date()): string {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
  return `${prefixFor(formName)}-${y}${m}${d}-${suffix}`;
}
