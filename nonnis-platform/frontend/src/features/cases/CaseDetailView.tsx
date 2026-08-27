"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { caseStatusMeta } from "@/lib/case-status";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { getCase } from "@/services/cases.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList, type DescriptionItem } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { CaseDetail } from "@/types/domain";
import { ServiceRequestCard } from "./ServiceRequestCard";
import { RequirementList } from "./RequirementList";
import { CaseWorkflowTimeline } from "./CaseWorkflowTimeline";

function overviewItems(detail: CaseDetail): DescriptionItem[] {
  return [
    { label: "Case Number", value: detail.caseNumber },
    { label: "External Case ID", value: detail.externalCaseId ?? "—" },
    { label: "Organization", value: `${detail.organization.name} (${humanizeEnum(detail.organization.type)})` },
    { label: "Created", value: formatDateTime(detail.createdAt) },
    { label: "Last Updated", value: formatDateTime(detail.updatedAt) },
    { label: "Discharge Professional", value: detail.dischargeProfessionalRef ?? "—" },
  ];
}

function dischargeItems(detail: CaseDetail): DescriptionItem[] {
  return [
    { label: "Expected Discharge", value: formatDate(detail.expectedDischargeDate) },
    { label: "Actual Discharge", value: formatDate(detail.actualDischargeDate) },
    { label: "Current Care Setting", value: detail.currentCareSetting ? humanizeEnum(detail.currentCareSetting) : "—" },
    { label: "Preferred Service Location", value: detail.preferredServiceLocation ?? "—" },
    { label: "Primary Language", value: detail.primaryLanguage ?? "—" },
    { label: "Interpreter Required", value: detail.interpreterRequired ? "Yes" : "No" },
    { label: "Communication Preference", value: detail.communicationPreference ?? "—" },
    {
      label: "Accessibility Needs",
      value: detail.accessibilityNeeds.length ? detail.accessibilityNeeds.join(", ") : "—",
    },
  ];
}

export function CaseDetailView({ caseId }: { caseId: string }) {
  const { activeOrganizationId } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getCase(caseId), [caseId, activeOrganizationId]);

  const backLink = (
    <Link href="/cases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      All cases
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading title="Case" breadcrumb={backLink} />
        <Panel>
          <LoadingState label="Loading case…" />
        </Panel>
      </div>
    );
  }

  if (error) {
    const notFound = "status" in error && (error as { status?: number }).status === 404;
    return (
      <div className="space-y-6">
        <PageHeading title="Case" breadcrumb={backLink} />
        <Panel>
          {notFound ? (
            <EmptyState title="Case not found" message="This case may have been removed or the link is incorrect." />
          ) : (
            <ErrorState message={error.message} onRetry={reload} />
          )}
        </Panel>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeading title="Case" breadcrumb={backLink} />
        <Panel>
          <EmptyState title="Case not found" />
        </Panel>
      </div>
    );
  }

  const status = caseStatusMeta(data.status);

  return (
    <div className="space-y-6">
      <PageHeading
        title={data.caseNumber}
        description={`Patient: ${data.patient.displayName}`}
        breadcrumb={backLink}
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Case Overview">
            <DescriptionList items={overviewItems(data)} />
          </Panel>

          <Panel title="Discharge Information">
            <DescriptionList items={dischargeItems(data)} />
          </Panel>

          <Panel title="Service Requests" description={`${data.serviceRequestsCount} requested`}>
            {data.serviceRequests.length === 0 ? (
              <EmptyState title="No service requests" message="No services have been requested for this case yet." />
            ) : (
              <div className="space-y-3">
                {data.serviceRequests.map((request) => (
                  <ServiceRequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Requirements" description={`${data.requirementsCount} recorded`}>
            {data.requirements.length === 0 ? (
              <EmptyState title="No requirements" message="No requirements have been recorded for this case yet." />
            ) : (
              <RequirementList requirements={data.requirements} />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Current Status">
            <div className="space-y-3">
              <StatusBadge label={status.label} tone={status.tone} />
              <DescriptionList
                items={[
                  { label: "Requirements", value: data.requirementsCount },
                  { label: "Service Requests", value: data.serviceRequestsCount },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Patient">
            <DescriptionList
              items={[
                { label: "Name", value: data.patient.displayName },
                { label: "Date of Birth", value: formatDate(data.patient.dateOfBirth) },
                { label: "External Ref", value: data.patient.externalRef ?? "—" },
              ]}
            />
          </Panel>

          <Panel title="Originating Facility">
            <DescriptionList
              items={[
                { label: "Facility", value: data.originatingFacility.name },
                {
                  label: "Location",
                  value:
                    [data.originatingFacility.city, data.originatingFacility.state].filter(Boolean).join(", ") || "—",
                },
              ]}
            />
          </Panel>

          <Panel title="Recent Workflow Events">
            {data.workflowEvents.length === 0 ? (
              <EmptyState title="No events yet" />
            ) : (
              <CaseWorkflowTimeline events={data.workflowEvents} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
