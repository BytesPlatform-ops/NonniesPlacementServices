"use client";

import { Info } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { getEmailStatus } from "@/services/communications-email.service";

/** Clear, non-alarming banner shown while the email provider is in mock mode. */
export function MockModeBanner() {
  const { data } = useAsync(() => getEmailStatus(), []);
  if (!data || !data.provider.mockMode) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <Info className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong>Mock email mode</strong> — no external email is delivered. Sends are simulated for testing. Configure Brevo to send real email.
      </span>
    </div>
  );
}
