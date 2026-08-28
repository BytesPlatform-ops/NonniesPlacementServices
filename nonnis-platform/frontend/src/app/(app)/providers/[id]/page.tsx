import { ProviderWorkspace } from "@/features/providers/ProviderWorkspace";

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderWorkspace providerId={id} />;
}
