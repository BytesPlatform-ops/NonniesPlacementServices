import { Panel } from "@/components/ui/Panel";
import type { CaseDetail } from "@/types/domain";
import { AttentionReasons, CompletenessMeter } from "./parts";

export function AssessmentTab({ caseDetail: c }: { caseDetail: CaseDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Completeness" description="What is still required before this case is ready for review.">
        <CompletenessMeter completeness={c.assessment.completeness} />
      </Panel>
      <Panel title="Attention & exceptions" description="Deterministic checks over the current case facts.">
        <AttentionReasons attention={c.assessment.attention} />
      </Panel>
      <Panel title="Structured needs summary">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Service requests</dt>
            <dd className="mt-0.5 font-medium text-umber">{c.serviceRequestsCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Requirements</dt>
            <dd className="mt-0.5 font-medium text-umber">{c.requirementsCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Open blockers</dt>
            <dd className="mt-0.5 font-medium text-umber">{c.assessment.completeness.blockers.length}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Blocked</dt>
            <dd className="mt-0.5 font-medium text-umber">{c.blocked ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
