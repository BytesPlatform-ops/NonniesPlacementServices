"use client";

import { useAsync } from "@/hooks/use-async";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { getSmsTemplate } from "@/services/communications-sms.service";
import { SmsTemplateEditor } from "./SmsTemplateEditor";

export function SmsTemplateEditorLoader({ templateId }: { templateId: string }) {
  const { data, loading, error, reload } = useAsync(() => getSmsTemplate(templateId), [templateId]);
  if (loading && !data) return <LoadingState label="Loading template…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  return <SmsTemplateEditor template={data} />;
}
