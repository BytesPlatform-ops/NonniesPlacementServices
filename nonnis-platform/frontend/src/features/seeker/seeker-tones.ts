import type { StatusTone } from "@/lib/case-status";

/**
 * Status → badge tone for the family portal.
 *
 * Kept in one place so a status never reads as reassuring in one view and
 * alarming in another. Anything unmapped falls back to neutral rather than
 * guessing, because a wrong colour on a placement status is worse than a plain
 * one.
 */
const AVAILABILITY_TONES: Record<string, StatusTone> = {
  AVAILABLE: "positive",
  PROVIDER_ACCEPTED: "positive",
  PLACEMENT_CONFIRMED: "positive",
  SERVICE_STARTED: "positive",
  PROVIDER_INTERESTED: "progress",
  REVIEWING: "info",
  INFORMATION_REQUESTED: "warning",
  LIMITED_AVAILABILITY: "warning",
  NO_AVAILABILITY: "negative",
  NOT_AVAILABLE: "negative",
  WITHDRAWN: "neutral",
  UNKNOWN: "neutral",
};

const ARRANGEMENT_TONES: Record<string, StatusTone> = {
  CONFIRMED: "positive",
  ARRANGED: "positive",
  PROVIDER_INTERESTED: "progress",
  PROVIDER_REVIEWING: "info",
  BEING_REVIEWED: "info",
  NOT_STARTED: "neutral",
  NOT_ARRANGED: "warning",
  CANCELLED: "neutral",
};

const REQUIREMENT_TONES: Record<string, StatusTone> = {
  COMPLETE: "positive",
  IN_PROGRESS: "progress",
  PENDING: "warning",
  BLOCKED: "negative",
  NOT_REQUIRED: "neutral",
};

const DOCUMENT_TONES: Record<string, StatusTone> = {
  ACCEPTED: "positive",
  UPLOADED: "info",
  REQUESTED: "warning",
  NEEDS_UPDATE: "negative",
};

const APPOINTMENT_TONES: Record<string, StatusTone> = {
  CONFIRMED: "positive",
  COMPLETED: "positive",
  SCHEDULED: "info",
  REQUESTED: "warning",
  RESCHEDULE_REQUESTED: "warning",
  CANCELLED: "neutral",
};

export const availabilityTone = (v: string): StatusTone => AVAILABILITY_TONES[v] ?? "neutral";
export const arrangementTone = (v: string): StatusTone => ARRANGEMENT_TONES[v] ?? "neutral";
export const requirementTone = (v: string): StatusTone => REQUIREMENT_TONES[v] ?? "neutral";
export const documentTone = (v: string): StatusTone => DOCUMENT_TONES[v] ?? "neutral";
export const appointmentTone = (v: string): StatusTone => APPOINTMENT_TONES[v] ?? "neutral";
