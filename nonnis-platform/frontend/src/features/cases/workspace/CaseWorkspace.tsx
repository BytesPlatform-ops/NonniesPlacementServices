"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { caseStatusMeta } from "@/lib/case-status";
import { attentionLabel, attentionTone } from "@/lib/attention";
import { formatDate, humanizeEnum } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { getCase } from "@/services/cases.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { CaseDetail } from "@/types/domain";
import { OverviewTab } from "./OverviewTab";
import { AssessmentTab } from "./AssessmentTab";
import { RequirementsTab } from "./RequirementsTab";
import { ServiceRequestsTab } from "./ServiceRequestsTab";
import { ActivityTab } from "./ActivityTab";
import { CaseHeaderActions } from "./CaseHeaderActions";

const TABS = ["Overview", "Assessment", "Service Requests", "Requirements", "Activity"] as const;
type Tab = (typeof TABS)[number];

export function CaseWorkspace({ caseId }: { caseId: string }) {
  const { activeOrganizationId, hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getCase(caseId), [caseId, activeOrganizationId]);
  const [tab, setTab] = useState<Tab>("Overview");

  const back = (
    <Link href="/cases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All cases
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading title="Case" breadcrumb={back} />
        <Panel><LoadingState label="Loading case…" /></Panel>
      </div>
    );
  }
  if (error || !data) {
    const notFound = error && "status" in error && (error as { status?: number }).status === 404;
    return (
      <div className="space-y-6">
        <PageHeading title="Case" breadcrumb={back} />
        <Panel>
          {notFound ? <EmptyState title="Case not found" /> : <ErrorState message={error?.message ?? "Not found"} onRetry={reload} />}
        </Panel>
      </div>
    );
  }

  const status = caseStatusMeta(data.status);
  const attention = data.assessment.attention;

  return (
    <div className="space-y-6">
      <PageHeading
        title={data.caseNumber}
        description={`Patient: ${data.patient.displayName} · ${data.originatingFacility.name}`}
        breadcrumb={back}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            {attention.level !== "NONE" ? (
              <StatusBadge label={attentionLabel(attention.level, attention.count)} tone={attentionTone(attention.level)} />
            ) : (
              <StatusBadge label="On track" tone="positive" />
            )}
          </div>
        }
      />

      <CaseHeaderActions caseDetail={data} canAssign={hasPermission(PERMISSIONS.CASES_CREATE) || hasPermission("cases.assign")} onChange={reload} />

      <HeaderFacts caseDetail={data} />

      <div>
        <div className="flex flex-wrap gap-1 border-b border-sage">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-umber"
                  : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-umber"
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {tab === "Overview" ? <OverviewTab caseDetail={data} /> : null}
          {tab === "Assessment" ? <AssessmentTab caseDetail={data} /> : null}
          {tab === "Service Requests" ? <ServiceRequestsTab caseDetail={data} onChange={reload} /> : null}
          {tab === "Requirements" ? <RequirementsTab caseDetail={data} onChange={reload} /> : null}
          {tab === "Activity" ? <ActivityTab caseDetail={data} /> : null}
        </div>
      </div>
    </div>
  );
}

function HeaderFacts({ caseDetail }: { caseDetail: CaseDetail }) {
  const facts = [
    { label: "Assigned", value: caseDetail.assignedDischargeProfessional?.displayName ?? "Unassigned" },
    { label: "Expected discharge", value: formatDate(caseDetail.expectedDischargeDate) },
    { label: "Care setting", value: caseDetail.currentCareSetting ? humanizeEnum(caseDetail.currentCareSetting) : "—" },
    { label: "Completeness", value: `${caseDetail.assessment.completeness.percentage}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="rounded-lg border border-sage bg-ivory px-4 py-3 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{f.label}</p>
          <p className="mt-1 truncate text-sm font-medium text-umber">{f.value}</p>
        </div>
      ))}
    </div>
  );
}
