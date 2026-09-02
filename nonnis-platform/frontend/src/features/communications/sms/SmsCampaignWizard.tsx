"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/states";
import { listLists } from "@/services/communications.service";
import { createSmsCampaign, getSmsStatus, listSmsTemplates, queueSmsCampaign, smsAudiencePreview } from "@/services/communications-sms.service";
import type { SmsAudiencePreview } from "@/types/communications-sms";
import { SegmentMeter } from "./SegmentMeter";
import { SmsConfigBanner } from "./SmsConfigBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const STEPS = ["Details", "Message", "Audience", "Review"];

export function SmsCampaignWizard() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const templates = useAsync(() => listSmsTemplates({ pageSize: 100 }), []);
  const lists = useAsync(() => listLists({ activeOnly: true, pageSize: 100 }), []);
  const status = useAsync(() => getSmsStatus(), []);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<SmsAudiencePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => (templates.data?.items ?? []).find((t) => t.id === templateId), [templates.data, templateId]);
  const audience = useMemo(() => ({ listIds }), [listIds]);
  const blocked = status.data && !status.data.campaignSendingAllowed ? status.data.campaignBlockedReason : null;

  const runPreview = async () => {
    setBusy(true); setError(null);
    try { setPreview(await smsAudiencePreview(audience, templateId)); setStep(4); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not evaluate the audience."); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!preview) return;
    const ok = await confirm({
      title: "Send SMS campaign?",
      description: `This campaign will be queued for ${preview.eligibleCount} eligible recipient${preview.eligibleCount === 1 ? "" : "s"} and is estimated to use ${preview.summary.estimatedSegmentCount} SMS segment${preview.summary.estimatedSegmentCount === 1 ? "" : "s"}. Contacts without SMS opt-in, opted-out contacts, invalid numbers, and suppressed numbers will not be sent.`,
      confirmLabel: "Queue campaign",
    });
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const created = await createSmsCampaign({ name: name.trim(), templateId, audience });
      await queueSmsCampaign(created.id);
      toast.success("SMS campaign queued");
      router.replace(`/communications/sms-campaigns/${created.id}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not queue the campaign."); setBusy(false); }
  };

  const toggleList = (id: string) => setListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <PageHeading title="New SMS campaign" description="Details → Message → Audience → Review. Nothing sends until you confirm." />
      <SmsConfigBanner />
      <div className="flex items-center gap-2 text-xs">
        {STEPS.map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${i + 1 <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
            <span className={i + 1 === step ? "font-medium text-umber" : "text-slate-500"}>{l}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-slate-300" /> : null}
          </div>
        ))}
      </div>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {step === 1 ? (
        <Panel title="1 · Details">
          <label className="block max-w-lg"><span className="text-xs font-medium text-slate-600">Campaign name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
          <p className="mt-3 text-xs text-slate-500">Messages send immediately once queued — there is no scheduling.</p>
          <div className="mt-4 flex justify-end"><button type="button" disabled={!name.trim()} onClick={() => setStep(2)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button></div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="2 · Message">
          {templates.loading ? <LoadingState label="Loading templates…" /> : (
            <div className="space-y-2">
              {(templates.data?.items ?? []).filter((t) => t.status !== "ARCHIVED").map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-400">
                  <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="h-4 w-4 text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-umber">{t.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{t.segments.encoding === "GSM7" ? "GSM-7" : "UCS-2"} · est. {t.segments.segmentCount} segment{t.segments.segmentCount === 1 ? "" : "s"}</span>
                  </span>
                </label>
              ))}
              {(templates.data?.items ?? []).length === 0 ? <p className="text-sm text-slate-500">No SMS templates yet. Create one under SMS Templates first.</p> : null}
            </div>
          )}
          {selectedTemplate ? (
            <div className="mt-4 rounded-lg border border-sage bg-ivory p-3">
              <p className="text-xs font-medium text-slate-500">Sample preview</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{selectedTemplate.name}</p>
              <div className="mt-2"><SegmentMeter info={selectedTemplate.segments} bodyLength={selectedTemplate.segments.characterCount} /></div>
              <p className="mt-2 text-xs text-slate-400">Each recipient&apos;s message is re-counted at send time — merge values change the length.</p>
            </div>
          ) : null}
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={!templateId} onClick={() => setStep(3)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button>
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel title="3 · Audience" description="Select one or more contact lists. A contact in several lists is messaged once.">
          <div className="space-y-1.5">
            {(lists.data?.items ?? []).map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-400">
                <input type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggleList(l.id)} className="h-4 w-4 rounded text-brand-600" />
                <span>{l.name} <span className="text-xs text-slate-500">· {l.memberCount} member{l.memberCount === 1 ? "" : "s"}</span></span>
              </label>
            ))}
            {(lists.data?.items ?? []).length === 0 ? <p className="text-sm text-slate-500">No lists yet. Create a list under Lists first.</p> : null}
          </div>
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy || listIds.length === 0} onClick={() => void runPreview()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Checking…" : "Review recipients"}</button>
          </div>
        </Panel>
      ) : null}

      {step === 4 && preview ? (
        <Panel title="4 · Review &amp; send">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-sage bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Campaign</p>
              <p className="font-medium text-umber">{name}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Template</p>
              <p className="text-sm text-slate-700">{selectedTemplate?.name}</p>
              {preview.sampleBody ? (
                <>
                  <p className="mt-2 text-xs font-medium text-slate-500">Example rendered message</p>
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl border border-sage bg-ivory p-2 text-sm text-slate-800">{preview.sampleBody}</p>
                </>
              ) : null}
            </div>
            <div className="rounded-lg border border-sage bg-white p-4">
              <p className="text-2xl font-semibold text-emerald-700">{preview.eligibleCount}</p>
              <p className="text-xs text-slate-500">eligible recipients (of {preview.totalUnique} unique contacts)</p>
              <p className="mt-3 text-lg font-semibold text-umber">{preview.summary.estimatedSegmentCount}</p>
              <p className="text-xs text-slate-500">estimated billable segments — not an exact cost</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>GSM-7 recipients: {preview.summary.gsm7RecipientCount}</li>
                <li>Unicode (UCS-2) recipients: {preview.summary.ucs2RecipientCount}</li>
                <li>Multi-segment recipients: {preview.summary.multiSegmentCount}</li>
                <li>Longest message: {preview.summary.longestBodyChars} characters</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-sage bg-ivory p-4">
            <p className="text-xs font-medium text-slate-500">Excluded: {preview.excludedCount}</p>
            <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
              <li>Consent unknown: {preview.exclusions.CONSENT_UNKNOWN}</li>
              <li>Opted out: {preview.exclusions.OPTED_OUT}</li>
              <li>Suppressed: {preview.exclusions.SUPPRESSED}</li>
              <li>No phone: {preview.exclusions.NO_PHONE}</li>
              <li>Invalid phone: {preview.exclusions.INVALID_PHONE}</li>
              <li>Archived: {preview.exclusions.CONTACT_ARCHIVED}</li>
              <li>Duplicates removed: {preview.duplicatesRemoved}</li>
            </ul>
          </div>

          {blocked ? <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{blocked}</p> : null}
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy || preview.eligibleCount === 0 || !!blocked} onClick={() => void send()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Queuing…" : `Queue for ${preview.eligibleCount}`}</button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

