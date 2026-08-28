import { ReferralDetail } from "@/features/provider-portal/ReferralDetail";

export default async function ProviderReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReferralDetail referralId={id} />;
}
