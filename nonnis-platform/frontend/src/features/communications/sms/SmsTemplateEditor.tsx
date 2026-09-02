"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, Loader2, Send } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { Modal } from "@/components/ui/Modal";
import { MutationButton } from "@/components/ui/MutationButton";
import { calculateSegments, MAX_SMS_BODY_CHARS } from "@/lib/sms-segments";
import { archiveSmsTemplate, createSmsTemplate, previewSms, testSms, updateSmsTemplate } from "@/services/communications-sms.service";
import type { SmsTemplateDetail } from "@/types/communications-sms";
import { SegmentMeter } from "./SegmentMeter";
import { SmsConfigBanner } from "./SmsConfigBanner";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/** The safe contact merge fields — identical to the server allow-list. */
const MERGE_FIELDS = ["firstName", "lastName", "fullName", "organizationName", "email"] as const;

export function SmsTemplateEditor({ template }: { template?: SmsTemplateDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canSend = hasPermission(PERMISSIONS.COMMUNICATIONS_SEND);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [preview, setPreview] = useState<{ renderedBody: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Instant local estimate; the backend recomputes authoritatively per recipient.
  const info = useMemo(() => calculateSegments(body), [body]);
  const tooLong = body.length > MAX_SMS_BODY_CHARS;
  const valid = name.trim().length > 0 && body.trim().length > 0 && !tooLong;

  const insertField = (field: string) => {
    const el = bodyRef.current;
    const token = `{{${field}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (template) {
        await updateSmsTemplate(template.id, { name: name.trim(), description: description.trim(), body });
        toast.success("Template saved");
        router.refresh();
      } else {
        const created = await createSmsTemplate({ name: name.trim(), description: description.trim() || undefined, body });
        toast.success("Template created");
        router.replace(`/communications/sms-templates/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the template.");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await previewSms(body));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not preview the message.");
    } finally {
      setPreviewing(false);
    }
  };

  const back = <Link href="/communications/sms-templates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden /> SMS Templates</Link>;

  return (
    <div className="space-y-4">
      <PageHeading
        title={template ? template.name : "New SMS template"}
        description="Plain text only — SMS has no formatting. Merge fields are limited to safe contact details."
        breadcrumb={back}
        actions={
          <div className="flex items-center gap-2">
            {template && canSend ? <button type="button" onClick={() => setShowTest(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Send className="h-4 w-4" aria-hidden /> Test SMS</button> : null}
            {template ? (
              <MutationButton variant="secondary" action={() => archiveSmsTemplate(template.id)} confirm={{ title: "Archive template?", description: "It will no longer be selectable for new campaigns.", confirmLabel: "Archive" }} successToast="Template archived" onSuccess={() => router.push("/communications/sms-templates")}>
                <span className="inline-flex items-center gap-1.5"><Archive className="h-4 w-4" aria-hidden /> Archive</span>
              </MutationButton>
            ) : null}
            <button type="button" onClick={() => void save()} disabled={!valid || saving} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      />
      <SmsConfigBanner context="template" />
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Message">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-medium text-slate-600">Template name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className="text-xs font-medium text-slate-600">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" className={inputCls} /></label>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-600">Insert merge field:</span>
                {MERGE_FIELDS.map((f) => (
                  <button key={f} type="button" onClick={() => insertField(f)} className="rounded-full border border-sage bg-ivory px-2 py-0.5 text-xs text-slate-700 hover:border-brand-400 hover:text-umber">
                    {`{{${f}}}`}
                  </button>
                ))}
              </div>
              <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Hi {{firstName}}, ..." className={`${inputCls} font-mono`} />
            </div>

            <div className="mt-3">
              <SegmentMeter info={info} bodyLength={body.length} />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Preview" description="Rendered by the server with sample contact values.">
            <button type="button" onClick={() => void runPreview()} disabled={previewing || !body.trim()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {previewing ? "Rendering…" : "Render preview"}
            </button>
            {preview ? (
              <div className="mt-3 rounded-2xl border border-sage bg-white p-3">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{preview.renderedBody}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Merge fields are replaced with sample values so you can see the real length.</p>
            )}
          </Panel>
        </div>
      </div>

      {showTest && template ? <TestSmsModal templateId={template.id} body={body} onClose={() => setShowTest(false)} /> : null}
    </div>
  );
}

function TestSmsModal({ templateId, body, onClose }: { templateId: string; body: string; onClose: () => void }) {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const info = calculateSegments(body);

  const send = async () => {
    setBusy(true);
    try {
      const r = await testSms(templateId, phone, body);
      setResult(r.message);
      if (r.ok) toast.success(r.mock ? "Mock SMS processed" : "Test SMS sent");
      else toast.error(r.message);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send the test message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Send a test SMS" onClose={onClose} size="md">
      <p className="text-sm text-slate-500">The message is rendered with sample values and sent through the configured provider. Test sends are rate limited.</p>
      <label className="mt-3 block"><span className="text-xs font-medium text-slate-600">Test phone number</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 0100" className={inputCls} autoFocus /></label>
      <div className="mt-3 rounded-md border border-sage bg-ivory p-3">
        <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{body}</p>
        <p className="mt-2 text-xs text-slate-500">{info.encoding === "GSM7" ? "GSM-7" : "UCS-2"} · est. {info.segmentCount} segment{info.segmentCount === 1 ? "" : "s"}</p>
      </div>
      {result ? <p className="mt-3 rounded-md border border-sage bg-white px-3 py-2 text-sm text-slate-700">{result}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Close</button>
        <button type="button" onClick={() => void send()} disabled={busy || !phone.trim()} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Sending…" : "Send test"}</button>
      </div>
    </Modal>
  );
}
