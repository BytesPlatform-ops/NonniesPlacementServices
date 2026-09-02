"use client";

import { AlertTriangle, FlaskConical } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { getSmsStatus } from "@/services/communications-sms.service";

/** Shows SMS provider/readiness state. Never exposes credentials. */
export function SmsConfigBanner({ context = "campaign" }: { context?: "campaign" | "template" }) {
  const { data } = useAsync(() => getSmsStatus(), []);
  if (!data) return null;

  if (data.mockMode) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-sage bg-ivory px-3 py-2 text-sm text-slate-600">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          Mock mode — messages are processed locally and no external SMS is delivered. Sending number{" "}
          <code className="rounded bg-cream px-1">{data.sendingNumber ?? "+1 415 555 0100"}</code>.
        </span>
      </div>
    );
  }

  const blocked = context === "campaign" ? data.campaignBlockedReason : data.directReplyBlockedReason;
  if (blocked) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{blocked}</span>
      </div>
    );
  }

  if (!data.webhooksConfigured) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>SMS sending is configured, but inbound replies and delivery callbacks are not connected yet. Configure the public webhook URL and Auth Token to receive replies in the Inbox.</span>
      </div>
    );
  }
  return null;
}
