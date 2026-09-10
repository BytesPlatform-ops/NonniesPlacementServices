"use client";

import Image from "next/image";
import Link from "next/link";
import { useAsync } from "@/hooks/use-async";
import { MutationButton } from "@/components/ui/MutationButton";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getSeekerMatch, requestSeekerTour } from "@/services/seeker.service";
import { ServiceCoverage } from "./SeekerMatchesView";
import { availabilityTone } from "./seeker-tones";
import { useSeekerCaseId } from "./use-seeker-case";

/**
 * A matched provider, as the family may see it.
 *
 * Everything rendered here comes from the family-safe projection: no internal
 * notes, licence details, staff commentary or bed counts exist in the payload
 * to render even by mistake.
 */
export function SeekerMatchDetailView({ referralId }: { referralId: string }) {
  const caseId = useSeekerCaseId();
  const state = useAsync(() => getSeekerMatch(referralId), [referralId]);

  if (state.loading) return <LoadingState label="Loading provider…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return null;

  const p = state.data;
  const q = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";

  return (
    <div className="space-y-6">
      <PageHeading
        title={p.providerName}
        description={[p.city, p.state].filter(Boolean).join(", ") || undefined}
        breadcrumb={
          <Link href={`/seeker/matches${q}`} className="hover:underline">
            ← Back to my matches
          </Link>
        }
        actions={<StatusBadge label={p.availabilityLabel} tone={availabilityTone(p.availability)} />}
      />

      {p.imageUrl ? (
        <div className="relative h-56 w-full overflow-hidden rounded-lg bg-slate-100">
          <Image src={p.imageUrl} alt={p.providerName} fill className="object-cover" sizes="100vw" unoptimized />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {p.summary ? (
            <Panel title="About this community">
              <p className="text-sm leading-relaxed text-slate-700">{p.summary}</p>
            </Panel>
          ) : null}

          <Panel title="Services offered">
            {p.services.length === 0 ? (
              <p className="text-sm text-slate-500">No services listed.</p>
            ) : (
              <ul className="divide-y divide-sage/70">
                {p.services.map((s) => (
                  <li key={s.name} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-umber">{s.name}</p>
                    {s.levelOfCare || s.description ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[s.levelOfCare, s.description].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="For your case">
            <ServiceCoverage match={p} />
            {p.isSelected ? (
              <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                This is your selected provider.
              </p>
            ) : null}
          </Panel>

          <Panel title="Practical details">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Languages</dt>
                <dd className="font-medium text-slate-800">{p.languages.join(", ") || "Not listed"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Funding accepted</dt>
                <dd className="font-medium text-slate-800">{p.paymentTypes.join(", ") || "Not listed"}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Would you like to visit?" description="We will arrange a time with the provider.">
            <MutationButton
              variant="primary"
              pendingLabel="Requesting…"
              confirm={{
                title: "Request a tour?",
                description: `We will contact ${p.providerName} to arrange a time and let you know.`,
                confirmLabel: "Request tour",
              }}
              action={() => requestSeekerTour({ referralId, caseId })}
              successToast="Tour requested. We will be in touch with a time."
            >
              Request a tour
            </MutationButton>
          </Panel>
        </div>
      </div>
    </div>
  );
}
