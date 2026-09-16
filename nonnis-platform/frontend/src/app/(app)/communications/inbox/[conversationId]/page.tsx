import { Suspense } from "react";
import { InboxView } from "@/features/communications/inbox/InboxView";

/**
 * Deep link to one conversation — the destination notifications point at.
 *
 * It renders the same Inbox as the index route with the conversation preselected,
 * so arriving from a notification lands in the full inbox (list, thread, details)
 * rather than an isolated page with no way back. Access is decided by the API:
 * the thread request 404s for anyone the backend does not authorize.
 */
export default async function InboxConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return (
    <Suspense fallback={null}>
      <InboxView initialConversationId={conversationId} />
    </Suspense>
  );
}
