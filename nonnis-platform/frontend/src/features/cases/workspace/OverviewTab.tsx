import { Panel } from "@/components/ui/Panel";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { formatDate, humanizeEnum } from "@/lib/format";
import type { CaseDetail } from "@/types/domain";
import { CaseWorkflowTimeline } from "../CaseWorkflowTimeline";
import { AttentionReasons, CompletenessMeter } from "./parts";

export function OverviewTab({ caseDetail: c }: { caseDetail: CaseDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Panel title="Patient">
          <DescriptionList
            items={[
              { label: "Name", value: c.patient.displayName },
              { label: "Date of birth", value: formatDate(c.patient.dateOfBirth) },
              { label: "Contact phone", value: c.patientContactPhone ?? "—" },
              { label: "External reference", value: c.patient.externalRef ?? "—" },
              { label: "Representative", value: c.representativeName ?? "—" },
              { label: "Representative contact", value: c.representativeContact ?? "—" },
            ]}
          />
        </Panel>

        <Panel title="Discharge & destination">
          <DescriptionList
            items={[
              { label: "Originating facility", value: c.originatingFacility.name },
              { label: "Assigned professional", value: c.assignedDischargeProfessional?.displayName ?? "Unassigned" },
              { label: "Expected discharge", value: formatDate(c.expectedDischargeDate) },
              { label: "Actual discharge", value: formatDate(c.actualDischargeDate) },
              { label: "Current care setting", value: c.currentCareSetting ? humanizeEnum(c.currentCareSetting) : "—" },
              { label: "Destination", value: c.preferredServiceLocation ?? "—" },
            ]}
          />
        </Panel>

        <Panel title="Communication & accessibility">
          <DescriptionList
            items={[
              { label: "Primary language", value: c.primaryLanguage ?? "—" },
              { label: "Interpreter", value: c.interpreterRequired ? "Required" : "Not required" },
              { label: "Communication preference", value: c.communicationPreference ?? "—" },
              { label: "Accessibility needs", value: c.accessibilityNeeds.length ? c.accessibilityNeeds.join(", ") : "—" },
            ]}
          />
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Assessment completeness">
          <CompletenessMeter completeness={c.assessment.completeness} />
        </Panel>
        <Panel title="Needs attention">
          <AttentionReasons attention={c.assessment.attention} />
        </Panel>
        <Panel title="Recent activity">
          {c.workflowEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <CaseWorkflowTimeline events={c.workflowEvents.slice(0, 6)} />
          )}
        </Panel>
      </div>
    </div>
  );
}
