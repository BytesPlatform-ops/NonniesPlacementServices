"use client";

import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { getSeekerCarePlan } from "@/services/seeker.service";
import { arrangementTone, requirementTone } from "./seeker-tones";
import { useSeekerCaseId } from "./use-seeker-case";

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function SeekerCarePlanView() {
  const caseId = useSeekerCaseId();
  const state = useAsync(() => getSeekerCarePlan(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading your care plan…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return <EmptyState title="No care plan available" />;

  const { services, requirements, careDetails, careRecipientName } = state.data;
  const list = (values: string[]): string | null => (values.length > 0 ? values.join(", ") : null);

  return (
    <div className="space-y-6">
      <PageHeading
        title="My Care Plan"
        description={`What we have been asked to arrange for ${careRecipientName}, and where each part stands.`}
      />

      <Panel title="Services requested" description="Each service shows what has actually been arranged so far.">
        {services.length === 0 ? (
          <EmptyState title="No services listed yet" message="Your care team will add these as the plan takes shape." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-umber">{s.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[s.levelOfCare, s.frequency, s.requestedStartDate ? `from ${formatDate(s.requestedStartDate)}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No further detail recorded"}
                  </p>
                </div>
                <StatusBadge label={s.arrangementLabel} tone={arrangementTone(s.arrangement)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Care requirements"
        description="Specific things that need to be in place. Required items are marked."
      >
        {requirements.length === 0 ? (
          <EmptyState title="Nothing outstanding" message="There are no recorded requirements on your case." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {requirements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-umber">
                    {r.label}
                    {r.mandatory ? <span className="ml-2 text-xs font-medium text-rose-600">Required</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[r.category, r.detail, r.dueDate ? `due ${formatDate(r.dueDate)}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge label={r.statusLabel} tone={requirementTone(r.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Care preferences and needs" description="The details we are matching against.">
        <dl className="divide-y divide-sage/50 text-sm">
          <Detail label="Current care setting" value={careDetails.currentCareSetting} />
          <Detail label="Preferred location" value={careDetails.preferredServiceLocation} />
          <Detail label="Preferred start date" value={careDetails.preferredStartDate ? formatDate(careDetails.preferredStartDate) : null} />
          <Detail label="Expected discharge" value={careDetails.expectedDischargeDate ? formatDate(careDetails.expectedDischargeDate) : null} />
          <Detail label="Primary language" value={careDetails.primaryLanguage} />
          <Detail label="Interpreter needed" value={careDetails.interpreterRequired ? "Yes" : null} />
          <Detail label="Contact preference" value={careDetails.communicationPreference} />
          <Detail label="Accessibility needs" value={list(careDetails.accessibilityNeeds)} />
          <Detail label="Funding / insurance" value={list(careDetails.fundingSources)} />
          <Detail label="Equipment needs" value={list(careDetails.equipmentNeeds)} />
          <Detail label="Transport needed" value={careDetails.transportationRequired ? "Yes" : null} />
        </dl>
      </Panel>
    </div>
  );
}
