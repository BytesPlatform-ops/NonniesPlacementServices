"use client";

import { useAsync } from "@/hooks/use-async";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { getTemplate } from "@/services/communications-email.service";
import { TemplateBuilder } from "./TemplateBuilder";

export function TemplateBuilderLoader({ templateId }: { templateId: string }) {
  const { data, loading, error, reload } = useAsync(() => getTemplate(templateId), [templateId]);
  if (loading) return <LoadingState label="Loading template…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  return <TemplateBuilder template={data} />;
}
