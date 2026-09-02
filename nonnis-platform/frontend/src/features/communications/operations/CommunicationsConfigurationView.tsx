"use client";

import { CheckCircle2, CircleAlert, FlaskConical, Mail, MessageSquare } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getCommunicationsConfiguration, getCommunicationsHealth } from "@/services/communications-operations.service";
import type { ChannelConfiguration } from "@/types/communications-operations";

const READINESS: Record<string, { label: string; className: string } | undefined> = {
  MOCK: { label: "Mock mode", className: "bg-slate-100 text-slate-700" },
  LIVE_READY: { label: "Ready for live", className: "bg-emerald-100 text-emerald-800" },
  INCOMPLETE: { label: "Missing configuration", className: "bg-amber-100 text-amber-800" },
};

const DETAIL_LABEL: Record<string, string> = {
  outboundSending: "Outbound sending",
  senderEmail: "Sender address",
  senderName: "Sender name",
  inboundProvider: "Inbound provider",
  inboundReplies: "Inbound replies",
  inboundDomain: "Reply domain",
  inboundWebhookSecretConfigured: "Inbound webhook secret",
  deliveryWebhookSecretConfigured: "Delivery webhook secret",
  messagingService: "Messaging Service",
  sendingNumber: "Sending number",
  a2pAcknowledged: "A2P registration acknowledged",
  inboundAdapter: "Inbound adapter",
  inboundWebhook: "Inbound webhook URL",
  statusCallback: "Status callback URL",
  campaignSendingAllowed: "Bulk campaigns allowed",
  directReplyAllowed: "Direct replies allowed",
};

function DetailValue({ value }: { value: string | boolean | null }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Configured</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert className="h-3.5 w-3.5" aria-hidden /> Not configured</span>
    );
  }
  return <span className="text-slate-700">{value ?? <span className="text-slate-400">Not set</span>}</span>;
}

function ChannelPanel({ title, icon, config }: { title: string; icon: React.ReactNode; config: ChannelConfiguration }) {
  const readiness = READINESS[config.readiness] ?? { label: "Missing configuration", className: "bg-amber-100 text-amber-800" };
  return (
    <Panel title={title}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-umber">Provider: {config.provider}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${readiness.className}`}>{readiness.label}</span>
      </div>

      {config.mockMode ? (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-sage bg-ivory px-3 py-2 text-sm text-slate-600">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          Running against the mock provider. Nothing is delivered externally, and no live-readiness is claimed.
        </p>
      ) : config.missing.length ? (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Still required for live operation:</p>
          <ul className="mt-1 list-disc pl-5">
            {config.missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      ) : (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> All required configuration is present.
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {Object.entries(config.details).map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-3 border-b border-sage/60 py-1">
            <dt className="text-slate-500">{DETAIL_LABEL[key] ?? key}</dt>
            <dd className="text-right"><DetailValue value={value} /></dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function CommunicationsConfigurationView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  const { data, loading, error, reload } = useAsync(() => getCommunicationsConfiguration(), []);
  const health = useAsync(() => (canManage ? getCommunicationsHealth() : Promise.resolve(null)), [canManage]);

  return (
    <div className="space-y-4">
      <PageHeading
        title="Communications Configuration"
        description="Provider status and live readiness. Credentials are never shown here or returned by the API."
      />

      {loading && !data ? (
        <LoadingState label="Loading configuration…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <EmptyState title="Configuration unavailable" message="The configuration status could not be loaded." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChannelPanel title="Email" icon={<Mail className="h-4 w-4 text-slate-400" aria-hidden />} config={data.email} />
          <ChannelPanel title="SMS" icon={<MessageSquare className="h-4 w-4 text-teal-600" aria-hidden />} config={data.sms} />
        </div>
      )}

      {canManage ? (
        <Panel title="Delivery queues" description="Current operational counts — not analytics.">
          {health.loading && !health.data ? (
            <LoadingState label="Loading queue health…" />
          ) : health.error ? (
            <ErrorState message={health.error.message} onRetry={health.reload} />
          ) : health.data ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ["Email campaigns", health.data.email],
                ["SMS campaigns", health.data.sms],
                ["Direct replies", health.data.replies],
              ] as const).map(([label, q]) => (
                <div key={label} className="rounded-lg border border-sage bg-ivory p-3">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-slate-500">Queued</dt><dd className="tabular-nums text-slate-700">{q.queued}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Processing</dt><dd className="tabular-nums text-slate-700">{q.processing}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Stale claims</dt><dd className={`tabular-nums ${q.staleClaims > 0 ? "text-amber-700" : "text-slate-700"}`}>{q.staleClaims}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Failed</dt><dd className={`tabular-nums ${q.failed > 0 ? "text-rose-700" : "text-slate-700"}`}>{q.failed}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Delivery uncertain</dt><dd className={`tabular-nums ${q.deliveryUnknown > 0 ? "text-amber-700" : "text-slate-700"}`}>{q.deliveryUnknown}</dd></div>
                  </dl>
                </div>
              ))}
              <p className="text-xs text-slate-500 sm:col-span-3">Inbound messages awaiting review: <strong className="text-slate-700">{health.data.inboundReviewPending}</strong></p>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
