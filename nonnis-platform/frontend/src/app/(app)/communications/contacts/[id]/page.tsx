import { ContactDetail } from "@/features/communications/ContactDetail";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetail contactId={id} />;
}
