export type DeliverySource = "EMAIL_CAMPAIGN" | "EMAIL_REPLY" | "SMS_CAMPAIGN" | "SMS_REPLY";

export interface RetryEligibility {
  allowed: boolean;
  /** True when re-sending could duplicate a message the provider may already hold. */
  requiresConfirmation: boolean;
  reason: string;
}

export interface DeliveryFailureView {
  id: string;
  source: DeliverySource;
  channel: "EMAIL" | "SMS";
  status: string;
  recipient: string | null;
  contactName: string | null;
  contextId: string | null;
  contextName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  occurredAt: string | null;
  retry: RetryEligibility;
}

export type Readiness = "MOCK" | "LIVE_READY" | "INCOMPLETE";

export interface ChannelConfiguration {
  provider: string;
  mockMode: boolean;
  readiness: Readiness;
  missing: string[];
  details: Record<string, string | boolean | null>;
}

export interface CommunicationsConfiguration {
  email: ChannelConfiguration;
  sms: ChannelConfiguration;
}

export interface QueueHealth {
  provider?: string;
  dispatcherEnabled?: boolean;
  queued: number;
  processing: number;
  staleClaims: number;
  failed: number;
  deliveryUnknown: number;
}

export interface CommunicationsHealth {
  email: Required<QueueHealth>;
  sms: Required<QueueHealth>;
  replies: QueueHealth;
  inboundReviewPending: number;
}
