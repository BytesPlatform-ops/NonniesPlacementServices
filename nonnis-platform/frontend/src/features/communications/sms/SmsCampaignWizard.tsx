"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePen, FilePlus2, Users } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/states";
import { listLists } from "@/services/communications.service";
import { AudienceListModal } from "./AudienceListModal";
import { createSmsCampaign, getSmsStatus, listSmsTemplates, queueSmsCampaign, smsAudiencePreview } from "@/services/communications-sms.service";
import type { SmsAudiencePreview } from "@/types/communications-sms";
import { SegmentMeter } from "./SegmentMeter";
import { SmsConfigBanner } from "./SmsConfigBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const STEPS = ["Details", "Message", "Audience", "Review"];

/**
 * Where the half-built campaign lives while the user steps out to edit a
 * template or an audience.
 *
 * sessionStorage, not a server draft: this is one person's unfinished thought in
 * one tab, and it should not outlive the tab or be visible anywhere else. It
 * exists only so "edit the template" is not the same as "lose your work".
 */
const DRAFT_KEY = "nonnis.sms-campaign.draft";

interface Draft {
  step: number;
  name: string;
  templateId: string;
  listIds: string[];
}

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    return {
      // Never restore straight onto Review: that screen shows counts from a
      // preview this session has not run yet.
      step: Math.min(3, Math.max(1, Number(d.step) || 1)),
      name: typeof d.name === "string" ? d.name : "",
      templateId: typeof d.templateId === "string" ? d.templateId : "",
      listIds: Array.isArray(d.listIds) ? d.listIds.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return null;
  }
}

export function SmsCampaignWizard() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const templates = useAsync(() => listSmsTemplates({ pageSize: 100 }), []);
  const lists = useAsync(() => listLists({ activeOnly: true, pageSize: 100 }), []);
  // Consent-driven audiences first: they are the ones that stay correct on their
  // own, so they should be the obvious choice rather than buried alphabetically.
  const audiences = useMemo(() => {
    const items = lists.data?.items ?? [];
    return [...items].sort((a, b) => (a.systemKey ? 0 : 1) - (b.systemKey ? 0 : 1));
  }, [lists.data]);
  const status = useAsync(() => getSmsStatus(), []);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<SmsAudiencePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewList, setViewList] = useState<string | null>(null);

  // Restore anything left behind before stepping out to a template or a list.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    setStep(draft.step);
    setName(draft.name);
    setTemplateId(draft.templateId);
    setListIds(draft.listIds);
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, name, templateId, listIds }));
    } catch {
      /* private window or blocked storage: stepping out simply loses the draft */
    }
  }, [step, name, templateId, listIds]);

  const clearDraft = () => {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing depends on it */
    }
  };

  /** Where the template editor and the lists page should return to. */
  const RETURN_TO = "/communications/sms-campaigns/new";

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
      // The draft has become a real campaign; leaving it behind would reopen a
      // stale one the next time somebody starts a new campaign.
      clearDraft();
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
                  {/* Stops the row's radio from toggling when the link is clicked. */}
                  <Link
                    href={`/communications/sms-templates/${t.id}?returnTo=${encodeURIComponent(RETURN_TO)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-slate-50"
                  >
                    <FilePen className="h-3.5 w-3.5" aria-hidden /> Edit
                  </Link>
                </label>
              ))}
              {(templates.data?.items ?? []).length === 0 ? <p className="text-sm text-slate-500">No SMS templates yet — create one below.</p> : null}
              <Link
                href={`/communications/sms-templates/new?returnTo=${encodeURIComponent(RETURN_TO)}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-brand-700 hover:border-brand-400 hover:bg-ivory"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden /> New template
              </Link>
              <p className="text-xs text-slate-400">Your campaign is kept as you left it while you edit a template.</p>
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
        <Panel title="3 · Audience" description="Select one or more audiences. A contact in several of them is messaged once.">
          <div className="space-y-1.5">
            {audiences.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-400">
                <input type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggleList(l.id)} className="mt-0.5 h-4 w-4 rounded text-brand-600" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {l.name}
                    <span className="text-xs text-slate-500">· {l.memberCount} member{l.memberCount === 1 ? "" : "s"}</span>
                    {l.systemKey ? (
                      <span className="rounded-full bg-sage/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-umber">auto</span>
                    ) : null}
                  </span>
                  {l.systemKey && l.description ? <span className="mt-0.5 block text-xs text-slate-500">{l.description}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewList(l.id); }}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-slate-50"
                >
                  <Users className="h-3.5 w-3.5" aria-hidden /> View list
                </button>
              </label>
            ))}
            {audiences.length === 0 ? <p className="text-sm text-slate-500">No audiences yet. Create a list under Lists first.</p> : null}
          </div>
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy || listIds.length === 0} onClick={() => void runPreview()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Checking…" : "Review recipients"}</button>
          </div>
        </Panel>
      ) : null}

      {viewList ? (
        <AudienceListModal
          listId={viewList}
          returnTo={RETURN_TO}
          onClose={() => setViewList(null)}
          onDuplicated={(newListId) => {
            // Swap the copy in for the original so this campaign uses the
            // tailored audience rather than the shared one.
            setListIds((prev) => [...prev.filter((id) => id !== viewList), newListId]);
            setViewList(null);
            setPreview(null);
            lists.reload();
          }}
        />
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

