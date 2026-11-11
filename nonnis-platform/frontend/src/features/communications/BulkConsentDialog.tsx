"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { Modal } from "@/components/ui/Modal";
import { bulkSetContactConsent, type ContactFilters } from "@/services/communications.service";
import type { BulkConsentResult, Channel } from "@/types/communications";
import { CONSENT_SOURCES } from "./labels";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Records consent for every contact the current filters match. The server
 * skips opted-out and suppressed contacts; the counts are previewed (a dry run)
 * before anything is written, so the person sees exactly what will change.
 */
export function BulkConsentDialog({ filters, total, onClose, onDone }: { filters: ContactFilters; total: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [channel, setChannel] = useState<Channel>("SMS");
  const [status, setStatus] = useState<"OPTED_IN" | "OPTED_OUT">("OPTED_IN");
  const [source, setSource] = useState("");
  const [attested, setAttested] = useState(false);
  const [preview, setPreview] = useState<BulkConsentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optIn = status === "OPTED_IN";
  const ready = !optIn || (source !== "" && attested);

  // Any change to what would be written invalidates the counts shown.
  useEffect(() => setPreview(null), [channel, status, source]);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await bulkSetContactConsent(filters, { channel, consentStatus: status, consentSource: source || undefined, dryRun });
      if (dryRun) {
        setPreview(r);
      } else {
        toast.success(`Consent updated on ${r.updated} contact${r.updated === 1 ? "" : "s"}`);
        onDone();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update consent.");
    } finally {
      setBusy(false);
    }
  };

  const channelWord = channel === "SMS" ? "text messages" : "emails";

  return (
    <Modal title="Update consent" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Applies to the <span className="font-medium text-umber">{total} contact{total === 1 ? "" : "s"}</span> matching your current filters.
          Filter by a list, a tag or &ldquo;SMS consent: Unknown&rdquo; first to narrow it down.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className={`${inputCls} bg-white`}>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Set consent to</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as "OPTED_IN" | "OPTED_OUT")} className={`${inputCls} bg-white`}>
              <option value="OPTED_IN">Opted in</option>
              <option value="OPTED_OUT">Opted out</option>
            </select>
          </label>
        </div>

        {optIn ? (
          <>
            <label className="block max-w-sm">
              <span className="text-xs font-medium text-slate-600">How was consent collected? <span className="text-rose-600">*</span></span>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select…</option>
                {CONSENT_SOURCES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
              <span>I confirm these contacts agreed to receive {channelWord} from Nonnis Placement. This is recorded with my name and the date.</span>
            </label>
            <p className="text-xs text-slate-500">Contacts who opted out (for example by replying STOP) or whose address is suppressed are skipped and keep their status.</p>
          </>
        ) : null}

        {preview ? (
          <div className="rounded-md border border-sage bg-white px-3 py-2 text-sm text-slate-700">
            <p className="font-medium text-umber">{preview.updated} contact{preview.updated === 1 ? "" : "s"} will be updated.</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
              {preview.alreadySet ? <li>{preview.alreadySet} already have this status</li> : null}
              {preview.skippedOptedOut ? <li>{preview.skippedOptedOut} skipped — opted out</li> : null}
              {preview.skippedSuppressed ? <li>{preview.skippedSuppressed} skipped — suppressed</li> : null}
              {preview.skippedNoAddress ? <li>{preview.skippedNoAddress} skipped — no {channel === "SMS" ? "phone" : "email"} on file</li> : null}
            </ul>
          </div>
        ) : null}

        {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          {preview ? (
            <button type="button" disabled={busy || !ready || preview.updated === 0} onClick={() => void run(false)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? "Saving…" : `Update ${preview.updated} contact${preview.updated === 1 ? "" : "s"}`}
            </button>
          ) : (
            <button type="button" disabled={busy || !ready || total === 0} onClick={() => void run(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? "Checking…" : "Review changes"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
