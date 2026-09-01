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
import { audiencePreview, createCampaign, getEmailStatus, listTemplates, queueCampaign } from "@/services/communications-email.service";
import type { AudienceEvaluation } from "@/types/communications-email";
import { MockModeBanner } from "./MockModeBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function CampaignWizard() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const templates = useAsync(() => listTemplates({ pageSize: 100 }), []);
  const lists = useAsync(() => listLists({ activeOnly: true, pageSize: 100 }), []);
  const status = useAsync(() => getEmailStatus(), []);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [senderName, setSenderName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<AudienceEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audience = useMemo(() => ({ listIds }), [listIds]);

  const runPreview = async () => {
    setBusy(true); setError(null);
    try { setPreview(await audiencePreview(audience)); setStep(4); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not evaluate the audience."); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!preview) return;
    const ok = await confirm({ title: "Send email campaign?", description: `This campaign will be queued for ${preview.eligibleCount} eligible recipient${preview.eligibleCount === 1 ? "" : "s"}. Suppressed, opted-out, invalid, and unknown-consent contacts will not be sent.`, confirmLabel: "Queue campaign" });
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const created = await createCampaign({ name: name.trim(), templateId, subject: subject.trim(), preheader: preheader.trim() || undefined, senderName: senderName.trim() || undefined, audience });
      await queueCampaign(created.id);
      toast.success("Campaign queued");
      router.replace(`/communications/email-campaigns/${created.id}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not queue the campaign."); setBusy(false); }
  };

  const toggleList = (id: string) => setListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const detailsValid = name.trim() && subject.trim();
  const senderEmail = status.data?.provider.senderEmail ?? "";

  return (
    <div className="space-y-4">
      <PageHeading title="New email campaign" description="Details → Template → Audience → Review. Nothing sends until you confirm." />
      <MockModeBanner />
      <div className="flex items-center gap-2 text-xs">
        {["Details", "Template", "Audience", "Review"].map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${i + 1 <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
            <span className={i + 1 === step ? "font-medium text-umber" : "text-slate-500"}>{l}</span>
            {i < 3 ? <span className="mx-1 h-px w-6 bg-slate-300" /> : null}
          </div>
        ))}
      </div>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {step === 1 ? (
        <Panel title="1 · Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium text-slate-600">Campaign name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-600">From name</span><input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={status.data?.provider.senderName ?? "Nonni's"} className={inputCls} /></label>
            <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-600">Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></label>
            <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-600">Preheader</span><input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Short preview text" className={inputCls} /></label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Sender email: <strong>{senderEmail || "configured sender"}</strong> (fixed to the verified sender).</p>
          <div className="mt-4 flex justify-end"><button type="button" disabled={!detailsValid} onClick={() => setStep(2)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button></div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="2 · Template">
          {templates.loading ? <LoadingState label="Loading templates…" /> : (
            <div className="space-y-2">
              {(templates.data?.items ?? []).filter((t) => t.status !== "ARCHIVED").map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-400">
                  <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="h-4 w-4 text-brand-600" />
                  <span><span className="font-medium text-umber">{t.name}</span> {t.subjectDefault ? <span className="text-sm text-slate-500">· {t.subjectDefault}</span> : null}</span>
                </label>
              ))}
              {(templates.data?.items ?? []).length === 0 ? <p className="text-sm text-slate-500">No templates yet. Create one under Email Templates first.</p> : null}
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={!templateId} onClick={() => setStep(3)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button>
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel title="3 · Audience" description="Select one or more contact lists. Duplicates across lists are counted once.">
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
        <Panel title="4 · Review & send">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-sage bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Campaign</p>
              <p className="font-medium text-umber">{name}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Subject</p>
              <p className="text-sm text-slate-700">{subject}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Sender</p>
              <p className="text-sm text-slate-700">{senderName || status.data?.provider.senderName} · {senderEmail}</p>
            </div>
            <div className="rounded-lg border border-sage bg-white p-4">
              <p className="text-2xl font-semibold text-emerald-700">{preview.eligibleCount}</p>
              <p className="text-xs text-slate-500">eligible recipients (of {preview.totalUnique} unique)</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>Excluded: {preview.excludedCount}</li>
                <li>Consent unknown: {preview.exclusions.CONSENT_UNKNOWN}</li>
                <li>Opted out: {preview.exclusions.OPTED_OUT}</li>
                <li>Suppressed: {preview.exclusions.SUPPRESSED}</li>
                <li>No/invalid email: {preview.exclusions.NO_EMAIL + preview.exclusions.INVALID_EMAIL}</li>
                <li>Archived: {preview.exclusions.CONTACT_ARCHIVED}</li>
                <li>Duplicates removed: {preview.duplicatesRemoved}</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Only opted-in, non-suppressed contacts are eligible. Content and recipients are snapshotted at queue time.</p>
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy || preview.eligibleCount === 0} onClick={() => void send()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Queuing…" : `Queue for ${preview.eligibleCount}`}</button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
