import { CaseWorkspace } from "@/features/cases/workspace/CaseWorkspace";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseWorkspace caseId={id} />;
}
