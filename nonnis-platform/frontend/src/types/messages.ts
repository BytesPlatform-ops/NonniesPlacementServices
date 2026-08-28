export type MessageScope = "CASE_TEAM" | "NONNIS_INTERNAL" | "PROVIDER_REFERRAL";

export interface MessageView {
  id: string;
  caseId: string;
  scope: MessageScope;
  referralId: string | null;
  sender: { id: string; name: string | null };
  body: string;
  createdAt: string;
}

export interface TimelineItem {
  id: string;
  source: "event" | "message";
  type: string;
  category: string;
  occurredAt: string;
  actor: string | null;
  title: string;
  detail: string | null;
}
