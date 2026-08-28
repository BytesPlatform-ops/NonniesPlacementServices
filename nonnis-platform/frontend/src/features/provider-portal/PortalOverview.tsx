"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { capacityLabel, capacityTone, providerStatusTone } from "@/lib/provider-status";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { usePortal } from "./portal-context";

const FIX_ROUTE: Record<string, string> = {
  PROFILE_CONTACT_MISSING: "/provider/profile",
  NO_SERVICES: "/provider/services",
  NO_COVERAGE: "/provider/coverage",
  NO_PAYMENT_TYPES: "/provider/payment",
  NO_LANGUAGES: "/provider/languages",
  NO_HOURS: "/provider/hours",
  CAPACITY_UNKNOWN: "/provider/capacity",
};

export function PortalOverview() {
  const { loading, error, data, reload } = usePortal();

  if (loading) return <LoadingState label="Loading your provider…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data || !data.hasProvider || !data.provider) {
    return (
      <div className="space-y-6">
        <PageHeading title="Provider portal" />
        <Panel>
          <EmptyState
            title="No provider profile"
            message="Your active organization isn't set up as a provider yet. Please contact Nonnis to have a provider profile created."
          />
        </Panel>
      </div>
    );
  }

  const p = data.provider;
  const s = data.summary!;
  const c = data.completeness!;

  const summaryItems = [
    { label: "Status", value: <StatusBadge label={humanizeEnum(p.status)} tone={providerStatusTone(p.status)} /> },
    { label: "Organization", value: p.organization.name },
    { label: "Phone", value: p.phone ?? "—" },
    { label: "Email", value: p.email ?? "—" },
    { label: "Location", value: [p.city, p.state].filter(Boolean).join(", ") || "—" },
    { label: "Website", value: p.website ?? "—" },
  ];

  const meterTone = c.percentage === 100 ? "bg-emerald-500" : c.percentage >= 60 ? "bg-brand-600" : "bg-amber-500";

  return (
    <div className="space-y-6">
      <PageHeading title={p.displayName} description="Your provider overview and operational information." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Panel title="Provider summary">
            {p.description ? <p className="mb-4 text-sm text-slate-600">{p.description}</p> : null}
            <DescriptionList items={summaryItems} />
          </Panel>

          <Panel title="Operational information">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Active services" value={s.servicesCount} />
              <Metric label="Coverage areas" value={s.coverageCount} />
              <Metric label="Payment types" value={s.paymentTypesCount} />
              <Metric label="Languages" value={s.languagesCount} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Availability</p>
                <div className="mt-1">
                  <StatusBadge label={capacityLabel(s.availability)} tone={capacityTone(s.availability)} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Capacity updated</p>
                <p className="mt-1 text-sm text-slate-700">{s.lastCapacityUpdate ? formatDateTime(s.lastCapacityUpdate) : "—"}</p>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Profile completeness" description={`${c.percentage}% complete`}>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-cream">
            <div
              className={`h-full rounded-full ${meterTone}`}
              style={{ width: `${c.percentage}%` }}
              role="progressbar"
              aria-valuenow={c.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <ul className="space-y-2">
            {c.checks.map((check) => (
              <li key={check.code} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 text-amber-500" aria-hidden />
                  )}
                  <span className={check.ok ? "text-slate-500" : "text-umber"}>{check.label}</span>
                </span>
                {!check.ok && FIX_ROUTE[check.code] ? (
                  <Link href={FIX_ROUTE[check.code]!} className="text-xs font-medium text-brand-700 hover:underline">
                    Add
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-umber">{value}</p>
    </div>
  );
}
