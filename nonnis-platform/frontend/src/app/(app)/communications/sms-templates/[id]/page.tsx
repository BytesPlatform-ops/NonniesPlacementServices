import { SmsTemplateEditorLoader } from "@/features/communications/sms/SmsTemplateEditorLoader";

export default async function SmsTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SmsTemplateEditorLoader templateId={id} />;
}
