import { TemplateBuilderLoader } from "@/features/communications/email/TemplateBuilderLoader";
export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateBuilderLoader templateId={id} />;
}
