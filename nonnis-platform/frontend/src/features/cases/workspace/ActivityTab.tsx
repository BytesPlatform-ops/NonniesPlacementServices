import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/states";
import type { CaseDetail } from "@/types/domain";
import { CaseWorkflowTimeline } from "../CaseWorkflowTimeline";

export function ActivityTab({ caseDetail: c }: { caseDetail: CaseDetail }) {
  return (
    <Panel title="Workflow history" description="Every recorded change to this case.">
      {c.workflowEvents.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <CaseWorkflowTimeline events={c.workflowEvents} />
      )}
    </Panel>
  );
}
