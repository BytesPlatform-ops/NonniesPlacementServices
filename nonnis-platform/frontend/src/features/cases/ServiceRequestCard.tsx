import { DescriptionList, type DescriptionItem } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, humanizeEnum } from "@/lib/format";
import type { ServiceRequestView } from "@/types/domain";

const REQUEST_STATUS_TONE = {
  REQUESTED: "neutral",
  MATCHING: "progress",
  FULFILLED: "positive",
  CANCELLED: "negative",
} as const;

export function ServiceRequestCard({ request }: { request: ServiceRequestView }) {
  const items: DescriptionItem[] = [];
  const push = (label: string, value: string | number | null): void => {
    if (value !== null && value !== "") items.push({ label, value });
  };

  push("Level of Care", request.levelOfCare ? humanizeEnum(request.levelOfCare) : null);
  push("Requested Start", request.requestedStartDate ? formatDate(request.requestedStartDate) : null);
  push("Frequency", request.frequency);
  push("Duration", request.durationText);
  const geo = [request.serviceCity, request.serviceState, request.servicePostalCode].filter(Boolean).join(", ");
  push("Service Area", geo || null);
  push("Radius (mi)", request.serviceRadiusMiles);
  push("Funding Source", request.fundingSource);
  push("Insurance Plan", request.insurancePlan);
  push("Authorization", request.authorizationReference);

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{humanizeEnum(request.category)}</h3>
        <StatusBadge label={humanizeEnum(request.status)} tone={REQUEST_STATUS_TONE[request.status]} />
      </div>
      {items.length > 0 ? (
        <div className="mt-3">
          <DescriptionList items={items} />
        </div>
      ) : null}
      {request.notes ? <p className="mt-3 text-sm text-slate-600">{request.notes}</p> : null}
    </div>
  );
}
