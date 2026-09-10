import { SeekerMatchDetailView } from "@/features/seeker/SeekerMatchDetailView";

export default async function SeekerMatchPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = await params;
  return <SeekerMatchDetailView referralId={referralId} />;
}
