import { PageHeading } from "@/components/ui/PageHeading";
import { CaseQueue } from "@/features/operations/CaseQueue";

export default function OperationsCasesPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Case queue" description="Every case across the network, filterable by operational state." />
      <CaseQueue title="Cases" />
    </div>
  );
}
