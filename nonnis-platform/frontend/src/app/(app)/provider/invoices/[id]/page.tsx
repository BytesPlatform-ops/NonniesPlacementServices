import { ProviderInvoiceDetailView } from "@/features/invoices/ProviderInvoiceDetailView";

export default async function ProviderInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderInvoiceDetailView invoiceId={id} />;
}
