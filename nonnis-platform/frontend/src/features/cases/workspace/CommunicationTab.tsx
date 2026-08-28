"use client";

import { Lock } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { listCaseMessages, listInternalNotes, sendCaseMessage, sendInternalNote } from "@/services/messages.service";
import type { CaseDetail } from "@/types/domain";
import { Panel } from "@/components/ui/Panel";
import { MessageThread } from "@/features/messages/MessageThread";

export function CommunicationTab({ caseDetail }: { caseDetail: CaseDetail }) {
  const { hasPermission } = useAuth();
  const canSend = hasPermission(PERMISSIONS.MESSAGES_SEND);
  const canInternal = hasPermission(PERMISSIONS.INTERNAL_NOTES_MANAGE);

  return (
    <div className="space-y-6">
      <Panel title="Case team" description="Communication between the case organization and Nonnis. Providers do not see this.">
        <MessageThread
          load={() => listCaseMessages(caseDetail.id)}
          send={(body) => sendCaseMessage(caseDetail.id, body)}
          canSend={canSend}
          emptyLabel="Start the conversation with your case team."
        />
      </Panel>

      {canInternal ? (
        <Panel title="Internal notes">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Visible to Nonnis staff only
          </p>
          <MessageThread
            load={() => listInternalNotes(caseDetail.id)}
            send={(body) => sendInternalNote(caseDetail.id, body)}
            canSend
            emptyLabel="No internal notes yet."
            placeholder="Add an internal note…"
          />
        </Panel>
      ) : null}
    </div>
  );
}
