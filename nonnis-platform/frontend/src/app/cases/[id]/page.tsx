import { CaseDetailView } from "@/features/cases/CaseDetailView";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetailView caseId={id} />;
}
