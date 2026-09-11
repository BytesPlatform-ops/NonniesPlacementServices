import { ProviderListingEditor } from "@/features/marketplace/ProviderListingEditor";

export default async function ProviderListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderListingEditor listingId={id} />;
}
