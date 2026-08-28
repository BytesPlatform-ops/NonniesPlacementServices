import type { Message, MessageScope } from "@prisma/client";

export interface MessageView {
  id: string;
  caseId: string;
  scope: MessageScope;
  referralId: string | null;
  sender: { id: string; name: string | null };
  body: string;
  createdAt: string;
}

export function toMessageView(msg: Message, names: Map<string, string | null>): MessageView {
  return {
    id: msg.id,
    caseId: msg.caseId,
    scope: msg.scope,
    referralId: msg.referralId,
    sender: { id: msg.senderUserId, name: names.get(msg.senderUserId) ?? null },
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
  };
}
