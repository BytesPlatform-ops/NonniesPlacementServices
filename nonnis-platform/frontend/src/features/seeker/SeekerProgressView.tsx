"use client";

import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { getSeekerDashboard, getSeekerProgress } from "@/services/seeker.service";
import { JourneyRail } from "./JourneyRail";
import { useSeekerCaseId } from "./use-seeker-case";

/**
 * The case history as family-friendly milestones.
 *
 * Built from the same WorkflowEvent history the staff timeline uses, with the
 * internal event types (tasks, assignments, internal notes, notification
 * plumbing) filtered out server-side.
 */
export function SeekerProgressView() {
  const caseId = useSeekerCaseId();
  const dashboard = useAsync(() => getSeekerDashboard(caseId), [caseId]);
  const state = useAsync(() => getSeekerProgress(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading your progress…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;

  const milestones = state.data?.milestones ?? [];

  return (
    <div className="space-y-6">
      <PageHeading title="Progress" description="Every step of the placement, oldest first." />

      {dashboard.data ? (
        <Panel title="Where things stand">
          <JourneyRail stages={dashboard.data.journey} />
        </Panel>
      ) : null}

      <Panel title="History">
        {milestones.length === 0 ? (
          <EmptyState title="No history yet" message="Milestones will appear here as your placement progresses." />
        ) : (
          <ol className="relative space-y-4 border-l border-sage pl-5">
            {milestones.map((m) => (
              <li key={m.id} className="relative">
                <span className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-brand-700" aria-hidden />
                <p className="text-sm font-medium text-slate-800">{m.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(m.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
