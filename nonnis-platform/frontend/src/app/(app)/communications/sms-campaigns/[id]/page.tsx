import { SmsCampaignDetail } from "@/features/communications/sms/SmsCampaignDetail";

export default async function SmsCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SmsCampaignDetail campaignId={id} />;
}
