"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getSeekerMatches } from "@/services/seeker.service";
import type { SeekerProviderMatch } from "@/types/seeker";
import { availabilityTone } from "./seeker-tones";
import { useSeekerCaseId } from "./use-seeker-case";

/**
 * Services this provider covers, against what the case asked for.
 *
 * A plain count and two lists — there is no match percentage anywhere in the
 * platform, and inventing one here would be a number a family could not check.
 */
export function ServiceCoverage({ match }: { match: SeekerProviderMatch }) {
  const total = match.servicesCovered.length + match.servicesNotCovered.length;
  if (total === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-600">
        Supports {match.servicesCovered.length} of {total} services you asked for
      </p>
      <ul className="mt-1.5 space-y-1">
        {match.servicesCovered.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs text-emerald-700">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> {s}
          </li>
        ))}
        {match.servicesNotCovered.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden /> {s} — not listed
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeekerMatchesView() {
  const caseId = useSeekerCaseId();
  const state = useAsync(() => getSeekerMatches(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading providers…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;

  const providers = state.data?.providers ?? [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="My Matches"
        description="The providers being considered for your case. Only providers we have actually contacted appear here."
      />

      {providers.length === 0 ? (
        <Panel>
          <EmptyState
            title="No providers yet"
            message="Our care team is reviewing the care needs. Providers will appear here once we start contacting them."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => (
            <Panel key={p.referralId} className={p.isSelected ? "ring-2 ring-emerald-500/40" : undefined}>
              <div className="flex gap-4">
                {p.imageUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <Image src={p.imageUrl} alt={p.providerName} fill className="object-cover" sizes="80px" unoptimized />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-umber">{p.providerName}</p>
                      <p className="text-xs text-slate-500">
                        {[p.city, p.state].filter(Boolean).join(", ") || "Location not listed"}
                      </p>
                    </div>
                    <StatusBadge label={p.availabilityLabel} tone={availabilityTone(p.availability)} />
                  </div>
                  {p.isSelected ? (
                    <p className="mt-1.5 text-xs font-semibold text-emerald-700">Selected provider</p>
                  ) : null}
                  {p.summary ? <p className="mt-2 line-clamp-2 text-xs text-slate-600">{p.summary}</p> : null}
                  <ServiceCoverage match={p} />
                  <Link
                    href={`/seeker/matches/${p.referralId}`}
                    className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
