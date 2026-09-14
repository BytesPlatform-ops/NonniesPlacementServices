import type { NotificationPriority } from "@prisma/client";

/**
 * Every notification the platform can raise, in one place.
 *
 * Priority is a property of the EVENT, not of the person reading it and never
 * of the frontend: "a provider must answer this request" is HIGH whoever looks
 * at it. Keeping the catalog here means a new notification type is one entry
 * plus one call site, and the wording of an existing one can be corrected
 * without hunting through services.
 *
 * `route` is where the reader should land. It is advisory: the destination
 * re-checks authorization when it is opened, exactly as it would for a typed
 * URL, so a stored route can never widen anyone's access.
 */
export const NOTIFICATION_TYPES = {
  // ---- marketplace: provider side ----
  MARKETPLACE_ORDER_REQUESTED: "marketplace_order.requested",
  MARKETPLACE_ORDER_CANCELLED_BY_SEEKER: "marketplace_order.cancelled_by_seeker",
  MARKETPLACE_LISTING_MODERATED: "marketplace_listing.moderated",
  // ---- marketplace: family side ----
  MARKETPLACE_ORDER_ACCEPTED: "marketplace_order.accepted",
  MARKETPLACE_ORDER_DECLINED: "marketplace_order.declined",
  MARKETPLACE_ORDER_PAYMENT_RECORDED: "marketplace_order.payment_recorded",
  MARKETPLACE_ORDER_RENTAL_STARTED: "marketplace_order.rental_started",
  MARKETPLACE_ORDER_COMPLETED: "marketplace_order.completed",
  MARKETPLACE_ORDER_CANCELLED_BY_PROVIDER: "marketplace_order.cancelled_by_provider",
  // ---- referrals ----
  REFERRAL_RECEIVED: "referral.received",
  REFERRAL_RESPONDED: "referral.responded",
  // ---- case work ----
  TASK_ASSIGNED: "task.assigned",
  DOCUMENT_REQUESTED: "document.requested",
  DOCUMENT_NEEDS_UPDATE: "document.needs_update",
  DOCUMENT_UPLOADED: "document.uploaded",
  APPOINTMENT_REQUESTED: "appointment.requested",
  APPOINTMENT_SCHEDULED: "appointment.scheduled",
  // ---- messages ----
  FAMILY_MESSAGE_FROM_STAFF: "message.family_from_staff",
  FAMILY_MESSAGE_FROM_FAMILY: "message.family_from_family",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface NotificationDefinition {
  priority: NotificationPriority;
  /** Short label for the source column in the notification centre. */
  source: string;
}

/**
 * HIGH means "someone is waiting on you". NORMAL is a status change you asked
 * to follow. LOW is informational. CRITICAL is reserved for a blocked or
 * failing system and is deliberately unused by ordinary business events, so it
 * keeps its meaning when something really does go wrong.
 */
export const NOTIFICATION_DEFINITIONS: Record<NotificationType, NotificationDefinition> = {
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_REQUESTED]: { priority: "HIGH", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_CANCELLED_BY_SEEKER]: { priority: "NORMAL", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_LISTING_MODERATED]: { priority: "HIGH", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_ACCEPTED]: { priority: "HIGH", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_DECLINED]: { priority: "NORMAL", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_PAYMENT_RECORDED]: { priority: "NORMAL", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_RENTAL_STARTED]: { priority: "NORMAL", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_COMPLETED]: { priority: "LOW", source: "Marketplace" },
  [NOTIFICATION_TYPES.MARKETPLACE_ORDER_CANCELLED_BY_PROVIDER]: { priority: "HIGH", source: "Marketplace" },
  [NOTIFICATION_TYPES.REFERRAL_RECEIVED]: { priority: "HIGH", source: "Referrals" },
  [NOTIFICATION_TYPES.REFERRAL_RESPONDED]: { priority: "NORMAL", source: "Referrals" },
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: { priority: "HIGH", source: "Tasks" },
  [NOTIFICATION_TYPES.DOCUMENT_REQUESTED]: { priority: "HIGH", source: "Documents" },
  [NOTIFICATION_TYPES.DOCUMENT_NEEDS_UPDATE]: { priority: "HIGH", source: "Documents" },
  [NOTIFICATION_TYPES.DOCUMENT_UPLOADED]: { priority: "NORMAL", source: "Documents" },
  [NOTIFICATION_TYPES.APPOINTMENT_REQUESTED]: { priority: "HIGH", source: "Appointments" },
  [NOTIFICATION_TYPES.APPOINTMENT_SCHEDULED]: { priority: "NORMAL", source: "Appointments" },
  [NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_STAFF]: { priority: "NORMAL", source: "Messages" },
  [NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_FAMILY]: { priority: "NORMAL", source: "Messages" },
};

/**
 * The destination for one notification, per audience.
 *
 * A provider and a family member reading about the same order belong on
 * different screens, so the route is decided where the notification is raised
 * rather than derived from the type alone.
 */
export const ROUTES = {
  providerOrder: () => "/provider/marketplace-orders",
  providerListings: () => "/provider/listings",
  providerReferral: (referralId: string) => `/provider/referrals/${referralId}`,
  seekerOrders: () => "/seeker/orders",
  seekerDocuments: () => "/seeker/documents",
  seekerAppointments: () => "/seeker/appointments",
  seekerMessages: () => "/seeker/messages",
  staffCase: (caseId: string) => `/cases/${caseId}`,
  staffTasks: () => "/operations/tasks",
} as const;

/**
 * The idempotency key for one occurrence of one event.
 *
 * Built from the event type and the entity it concerns, so re-processing the
 * same acceptance — a retried request, a double-clicked button — collides on
 * the unique index and notifies nobody a second time. Events that legitimately
 * repeat for the same entity (a new message, a new document) add their own
 * discriminator, so they are not wrongly collapsed into one.
 */
export function eventKey(type: NotificationType, entityId: string, discriminator?: string): string {
  return discriminator ? `${type}:${entityId}:${discriminator}` : `${type}:${entityId}`;
}
