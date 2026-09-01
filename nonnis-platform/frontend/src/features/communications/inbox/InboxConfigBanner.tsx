"use client";

import { AlertTriangle, FlaskConical } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { getEmailStatus } from "@/services/communications-email.service";

/** Communicates provider/inbound configuration state without exposing secrets. */
export function InboxConfigBanner() {
  const { data } = useAsync(() => getEmailStatus(), []);
  if (!data) return null;
  const inbound = data.inbound;

  if (inbound?.sendingLiveButInboundMissing) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Email sending is configured, but inbound reply routing is not yet connected. Recipients&apos; replies will not reach this inbox until the reply subdomain, DNS/MX, and inbound webhook are configured.</span>
      </div>
    );
  }

  if (inbound?.mockMode || data.provider.mockMode) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-sage bg-ivory px-3 py-2 text-sm text-slate-600">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>Mock mode — inbound replies can be simulated locally (<code className="rounded bg-cream px-1">communications:simulate-email-reply</code>). No live email is sent or received.</span>
      </div>
    );
  }
  return null;
}
