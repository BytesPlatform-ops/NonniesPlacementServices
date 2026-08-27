import { OrganizationDetailView } from "@/features/admin/OrganizationDetailView";

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetailView organizationId={id} />;
}
