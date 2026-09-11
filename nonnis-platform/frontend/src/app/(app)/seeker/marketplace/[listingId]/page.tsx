import { SeekerListingDetailView } from "@/features/marketplace/SeekerListingDetailView";

export default async function SeekerListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return <SeekerListingDetailView listingId={listingId} />;
}
