import { AdminInvoiceDetailView } from "@/features/invoices/AdminInvoiceDetailView";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminInvoiceDetailView invoiceId={id} />;
}
