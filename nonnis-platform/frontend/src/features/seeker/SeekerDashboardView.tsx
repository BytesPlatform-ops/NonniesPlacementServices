"use client";

import Link from "next/link";
import { CalendarClock, FileText, MessageSquare, Users } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSeekerDashboard, listSeekerCases } from "@/services/seeker.service";
import { JourneyRail } from "./JourneyRail";
import { SeekerCaseSwitcher } from "./SeekerCaseSwitcher";
import { useSeekerCaseId } from "./use-seeker-case";

function Tile({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border border-sage bg-ivory p-4 shadow-card transition hover:border-brand-700/40 hover:shadow-md"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-700/10 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight text-umber">{value}</span>
        <span className="block text-xs font-medium text-slate-600">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-xs text-slate-400">{hint}</span> : null}
      </span>
    </Link>
  );
}

export function SeekerDashboardView() {
  const caseId = useSeekerCaseId();
  const cases = useAsync(() => listSeekerCases(), []);
  const state = useAsync(() => getSeekerDashboard(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading your dashboard…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return <EmptyState title="No case is linked to your account yet" />;

  const d = state.data;
  const q = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";

  return (
    <div className="space-y-6">
      <PageHeading
        title={d.careRecipientName}
        description={d.statusHeadline}
        actions={<SeekerCaseSwitcher cases={cases.data ?? []} activeCaseId={d.caseId} />}
      />

      <Panel title="Where things stand" description={`Case ${d.caseNumber}`}>
        <JourneyRail stages={d.journey} />
        {d.nextAction ? (
          <p className="mt-5 rounded-md bg-brand-700/5 px-4 py-3 text-sm text-umber">{d.nextAction}</p>
        ) : null}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href={`/seeker/matches${q}`}
          icon={<Users className="h-4 w-4" aria-hidden />}
          value={String(d.activeMatchCount)}
          label={d.activeMatchCount === 1 ? "Provider being considered" : "Providers being considered"}
        />
        <Tile
          href={`/seeker/documents${q}`}
          icon={<FileText className="h-4 w-4" aria-hidden />}
          value={String(d.documentsNeededCount)}
          label={d.documentsNeededCount === 1 ? "Document still needed" : "Documents still needed"}
        />
        <Tile
          href={`/seeker/messages${q}`}
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
          value={String(d.newMessageCount)}
          label="New since your last message"
        />
        <Tile
          href={`/seeker/appointments${q}`}
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          value={d.upcomingAppointment ? d.upcomingAppointment.type : "—"}
          label="Next appointment"
          hint={
            d.upcomingAppointment?.scheduledAt ? formatDateTime(d.upcomingAppointment.scheduledAt) : "Nothing scheduled"
          }
        />
      </div>

      {d.selectedProvider ? (
        <Panel
          title="Your selected provider"
          description="This is the provider that accepted the referral."
          actions={
            d.selectedProvider.placementStatusLabel ? (
              <StatusBadge
                label={d.selectedProvider.placementStatusLabel}
                tone={d.selectedProvider.serviceStarted ? "positive" : "progress"}
              />
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-base font-semibold text-umber">{d.selectedProvider.providerName}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {[d.selectedProvider.city, d.selectedProvider.state].filter(Boolean).join(", ") || "—"}
              </p>
              {d.selectedProvider.phone ? (
                <a href={`tel:${d.selectedProvider.phone}`} className="mt-1 block text-sm text-brand-700 hover:underline">
                  {d.selectedProvider.phone}
                </a>
              ) : null}
              <Link
                href={`/seeker/matches/${d.selectedProvider.referralId}`}
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                View this provider
              </Link>
            </div>
            <dl className="space-y-2 text-sm">
              {/* Two separate facts, deliberately never merged: a confirmed
                  placement is not the same as care having begun. */}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Placement</dt>
                <dd className="font-medium text-slate-800">{d.selectedProvider.placementStatusLabel ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Scheduled start</dt>
                <dd className="font-medium text-slate-800">
                  {d.selectedProvider.scheduledStartAt ? formatDate(d.selectedProvider.scheduledStartAt) : "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Service started</dt>
                <dd className="font-medium text-slate-800">
                  {d.selectedProvider.serviceStarted
                    ? d.selectedProvider.actualStartAt
                      ? formatDate(d.selectedProvider.actualStartAt)
                      : "Yes"
                    : "Not yet"}
                </dd>
              </div>
            </dl>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest update">
          {d.latestUpdate ? (
            <div>
              <p className="text-sm font-medium text-slate-800">{d.latestUpdate.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(d.latestUpdate.at)}</p>
              <Link href={`/seeker/progress${q}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
                See the full history
              </Link>
            </div>
          ) : (
            <EmptyState title="No updates yet" message="Updates will appear here as your placement progresses." />
          )}
        </Panel>

        <Panel title="Your care details">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Assigned coordinator</dt>
              <dd className="font-medium text-slate-800">{d.assignedCoordinatorName ?? "To be assigned"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Anticipated start</dt>
              <dd className="font-medium text-slate-800">
                {d.anticipatedStartDate ? formatDate(d.anticipatedStartDate) : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Case reference</dt>
              <dd className="font-medium text-slate-800">{d.caseNumber}</dd>
            </div>
          </dl>
          <Link href={`/seeker/care-plan${q}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
            View the full care plan
          </Link>
        </Panel>
      </div>
    </div>
  );
}
