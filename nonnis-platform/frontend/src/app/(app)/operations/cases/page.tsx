import { PageHeading } from "@/components/ui/PageHeading";
import { CaseQueue } from "@/features/operations/CaseQueue";

const READINESS_TOGGLES = [
  "readyOnly",
  "notReadyOnly",
  "criticalBlockerOnly",
  "placementMissingOnly",
  "serviceUnscheduledOnly",
  "postDischargeNotStartedOnly",
  "nearTermNotReadyOnly",
] as const;

export default async function OperationsCasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialToggles: Record<string, boolean> = {};
  for (const key of READINESS_TOGGLES) {
    if (params[key]) initialToggles[key] = true;
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Case queue" description="Every case across the network, filterable by operational and readiness state." />
      <CaseQueue title="Cases" initialToggles={initialToggles} />
    </div>
  );
}
