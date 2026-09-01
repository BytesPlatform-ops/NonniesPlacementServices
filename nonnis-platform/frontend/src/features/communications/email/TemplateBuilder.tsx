"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronUp, Eye, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { Modal } from "@/components/ui/Modal";
import { MediaUpload } from "@/features/content/MediaUpload";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES } from "@/services/media.service";
import { createTemplate, previewTemplate, testSendTemplate, updateTemplate } from "@/services/communications-email.service";
import type { Align, Block, EmailDesign, EmailTemplateDetail, SimpleBlock } from "@/types/communications-email";
import { EMAIL_FONTS, MERGE_FIELDS } from "@/types/communications-email";
import { BLOCK_LABEL, blockId, defaultDesign, newBlock, type BlockType } from "./design-helpers";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const PALETTE: BlockType[] = ["text", "heading", "image", "button", "columns", "divider", "spacer"];

export function TemplateBuilder({ template }: { template?: EmailTemplateDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(template?.name ?? "Untitled template");
  const [subject, setSubject] = useState(template?.subjectDefault ?? "");
  const [preheader, setPreheader] = useState(template?.preheaderDefault ?? "");
  const [design, setDesign] = useState<EmailDesign>(template?.designJson ?? defaultDesign());
  const [selectedId, setSelectedId] = useState<string | null>(design.blocks[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [testOpen, setTestOpen] = useState(false);

  const touch = () => setDirty(true);
  const selected = design.blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (blocks: Block[]) => { setDesign((d) => ({ ...d, blocks })); touch(); };
  const addBlock = (type: BlockType) => { const b = newBlock(type); setDesign((d) => ({ ...d, blocks: [...d.blocks, b] })); setSelectedId(b.id); touch(); };
  const updateBlock = (id: string, patch: Partial<SimpleBlock>) => setBlocks(design.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (id: string, dir: -1 | 1) => {
    const i = design.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= design.blocks.length) return;
    const next = design.blocks.slice();
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setBlocks(next);
  };
  const remove = (id: string) => { setBlocks(design.blocks.filter((b) => b.id !== id)); if (selectedId === id) setSelectedId(null); };
  const setSettings = (patch: Partial<EmailDesign["settings"]>) => { setDesign((d) => ({ ...d, settings: { ...d.settings, ...patch } })); touch(); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = { name: name.trim(), subjectDefault: subject.trim() || undefined, preheaderDefault: preheader.trim() || undefined, designJson: design };
      if (template) { await updateTemplate(template.id, body); toast.success("Template saved"); setDirty(false); }
      else { const created = await createTemplate(body); toast.success("Template created"); router.replace(`/communications/email-templates/${created.id}`); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save the template."); }
    finally { setSaving(false); }
  };

  const openPreview = async () => {
    setError(null);
    try { const p = await previewTemplate({ designJson: design, preheader: preheader || undefined }); setPreview({ html: p.html }); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Preview failed — check block URLs and merge fields."); }
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sage pb-4">
        <div className="flex items-center gap-3">
          <Link href="/communications/email-templates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden /> Templates</Link>
          <input value={name} onChange={(e) => { setName(e.target.value); touch(); }} className="rounded-md border border-transparent px-2 py-1 font-display text-lg font-semibold text-umber hover:border-slate-300 focus:border-brand-600 focus:outline-none" />
          {dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : template ? <span className="text-xs text-slate-400">Saved</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void openPreview()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" aria-hidden /> Preview</button>
          {template ? <button type="button" onClick={() => setTestOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Send className="h-4 w-4" aria-hidden /> Test email</button> : null}
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_300px]">
        {/* Palette */}
        <div className="rounded-lg border border-sage bg-ivory p-3 shadow-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add block</p>
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {PALETTE.map((t) => (
              <button key={t} type="button" onClick={() => addBlock(t)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-left text-sm text-slate-700 hover:border-brand-400">{BLOCK_LABEL[t]}</button>
            ))}
          </div>
          <button type="button" onClick={() => setSelectedId(null)} className={cn("mt-3 w-full rounded-md px-2.5 py-1.5 text-left text-sm", selectedId === null ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50")}>Email settings</button>
        </div>

        {/* Canvas */}
        <div className="rounded-lg border border-sage p-4 shadow-card" style={{ background: design.settings.backgroundColor }}>
          <div className="mx-auto space-y-2 rounded-md p-4" style={{ maxWidth: design.settings.contentWidth, background: design.settings.contentBackgroundColor }}>
            {design.blocks.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">Add blocks from the palette.</p> : null}
            {design.blocks.map((b) => (
              <div key={b.id} onClick={() => setSelectedId(b.id)} className={cn("group relative cursor-pointer rounded-md border p-2", selectedId === b.id ? "border-brand-500 ring-1 ring-brand-500" : "border-transparent hover:border-slate-300")}>
                <BlockPreview block={b} settings={design.settings} />
                <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                  <IconBtn onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} label="Move up"><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} label="Move down"><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn onClick={(e) => { e.stopPropagation(); remove(b.id); }} label="Delete"><Trash2 className="h-3.5 w-3.5 text-rose-600" /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties */}
        <div className="rounded-lg border border-sage bg-ivory p-4 shadow-card">
          {selected ? <BlockProperties block={selected} onChange={(patch) => updateBlock(selected.id, patch)} onColumn={(colIdx, content) => {
            if (selected.type !== "columns") return;
            const cols: SimpleBlock[][] = selected.columns.map((col, i) => (i === colIdx ? [{ id: col[0]?.id ?? blockId(), type: "text" as const, content, align: "left" as const }] : col));
            setBlocks(design.blocks.map((b) => (b.id === selected.id ? { ...selected, columns: cols } : b)));
          }} /> : <SettingsPanel design={design} onChange={setSettings} subject={subject} setSubject={(v) => { setSubject(v); touch(); }} preheader={preheader} setPreheader={(v) => { setPreheader(v); touch(); }} />}
        </div>
      </div>

      {preview ? (
        <Modal title="Preview" onClose={() => setPreview(null)} size="lg">
          <div className="mb-3 flex gap-2">
            {(["desktop", "mobile"] as const).map((m) => <button key={m} type="button" onClick={() => setPreviewMode(m)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", previewMode === m ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600")}>{m === "desktop" ? "Desktop" : "Mobile"}</button>)}
          </div>
          <div className="mx-auto overflow-hidden rounded-md border border-sage bg-white" style={{ width: previewMode === "mobile" ? 360 : "100%" }}>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[60vh] w-full" />
          </div>
        </Modal>
      ) : null}

      {testOpen && template ? <TestSendModal templateId={template.id} defaultSubject={subject || template.name} onClose={() => setTestOpen(false)} /> : null}
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="rounded bg-white/90 p-1 text-slate-600 shadow-sm hover:text-umber">{children}</button>;
}

function BlockPreview({ block, settings }: { block: Block; settings: EmailDesign["settings"] }) {
  if (block.type === "columns") return <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">{block.columns.map((c, i) => <div key={i} className="rounded bg-slate-50 p-2">{c[0] && c[0].type === "text" ? c[0].content : "Column"}</div>)}</div>;
  switch (block.type) {
    case "heading":
      return <p className="font-semibold" style={{ textAlign: block.align, color: settings.textColor, fontSize: block.level === 1 ? 24 : block.level === 2 ? 20 : 16 }}>{block.content || "Heading"}</p>;
    case "text":
      return <p className="whitespace-pre-line text-sm" style={{ textAlign: block.align, color: settings.textColor }}>{block.content || "Text"}</p>;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return block.src ? <img src={block.src} alt={block.alt} style={{ width: `${block.widthPct}%`, marginLeft: block.align === "center" ? "auto" : undefined, marginRight: block.align === "center" ? "auto" : block.align === "right" ? 0 : undefined, display: "block" }} /> : <div className="rounded bg-slate-100 py-6 text-center text-xs text-slate-400">Image — set a URL</div>;
    case "button":
      return <div style={{ textAlign: block.align }}><span className="inline-block rounded px-4 py-2 text-sm font-medium" style={{ background: block.backgroundColor, color: block.textColor, borderRadius: block.radius }}>{block.label}</span></div>;
    case "divider":
      return <hr className="border-t border-sand" />;
    case "spacer":
      return <div style={{ height: block.height }} className="rounded bg-slate-50/50 text-center text-[10px] text-slate-300">spacer</div>;
  }
}

function MergeChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {MERGE_FIELDS.map((f) => <button key={f} type="button" onClick={() => onInsert(`{{${f}}}`)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{`{{${f}}}`}</button>)}
    </div>
  );
}

function AlignField({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return <label className="block"><span className="text-xs font-medium text-slate-600">Alignment</span><select value={value} onChange={(e) => onChange(e.target.value as Align)} className={`${inputCls} bg-white`}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>;
}

function columnText(col: SimpleBlock[] | undefined): string {
  const first = col?.[0];
  return first && first.type === "text" ? first.content : "";
}

function BlockProperties({ block, onChange, onColumn }: { block: Block; onChange: (patch: Partial<SimpleBlock>) => void; onColumn: (colIdx: number, content: string) => void }) {
  if (block.type === "columns") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-umber">Two columns</p>
        {[0, 1].map((i) => (
          <label key={i} className="block"><span className="text-xs font-medium text-slate-600">Column {i + 1} text</span>
            <textarea value={columnText(block.columns[i])} onChange={(e) => onColumn(i, e.target.value)} rows={3} className={inputCls} />
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-umber">{BLOCK_LABEL[block.type]}</p>
      {block.type === "text" ? (
        <>
          <label className="block"><span className="text-xs font-medium text-slate-600">Content</span><textarea value={block.content} onChange={(e) => onChange({ content: e.target.value })} rows={6} className={`${inputCls} font-mono`} /></label>
          <p className="text-[11px] text-slate-400">Formatting: **bold**, *italic*, [label](https://url). Insert a merge field:</p>
          <MergeChips onInsert={(t) => onChange({ content: `${block.content}${t}` })} />
          <AlignField value={block.align} onChange={(a) => onChange({ align: a })} />
        </>
      ) : null}
      {block.type === "heading" ? (
        <>
          <label className="block"><span className="text-xs font-medium text-slate-600">Text</span><input value={block.content} onChange={(e) => onChange({ content: e.target.value })} className={inputCls} /></label>
          <MergeChips onInsert={(t) => onChange({ content: `${block.content}${t}` })} />
          <label className="block"><span className="text-xs font-medium text-slate-600">Level</span><select value={block.level} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })} className={`${inputCls} bg-white`}><option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option></select></label>
          <AlignField value={block.align} onChange={(a) => onChange({ align: a })} />
        </>
      ) : null}
      {block.type === "image" ? (
        <>
          <MediaUpload label="Image" kind="email-image" accept={IMAGE_ACCEPT} maxBytes={MAX_IMAGE_BYTES} variant="image" value={{ url: block.src || null, storagePath: null }} initialStoragePath={null} onChange={(v) => onChange({ src: v.url ?? "" })} />
          <label className="block"><span className="text-xs font-medium text-slate-600">Alt text</span><input value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Width %</span><input type="number" min={10} max={100} value={block.widthPct} onChange={(e) => onChange({ widthPct: Number(e.target.value) })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Link URL (optional)</span><input value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value || undefined })} placeholder="https://…" className={inputCls} /></label>
          <AlignField value={block.align} onChange={(a) => onChange({ align: a })} />
        </>
      ) : null}
      {block.type === "button" ? (
        <>
          <label className="block"><span className="text-xs font-medium text-slate-600">Label</span><input value={block.label} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">URL</span><input value={block.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://…" className={inputCls} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-xs font-medium text-slate-600">Background</span><input type="color" value={block.backgroundColor} onChange={(e) => onChange({ backgroundColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
            <label className="block"><span className="text-xs font-medium text-slate-600">Text</span><input type="color" value={block.textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
          </div>
          <AlignField value={block.align} onChange={(a) => onChange({ align: a })} />
        </>
      ) : null}
      {block.type === "spacer" ? <label className="block"><span className="text-xs font-medium text-slate-600">Height (px)</span><input type="number" min={4} max={200} value={block.height} onChange={(e) => onChange({ height: Number(e.target.value) })} className={inputCls} /></label> : null}
      {block.type === "divider" ? <p className="text-sm text-slate-500">A horizontal divider line.</p> : null}
    </div>
  );
}

function SettingsPanel({ design, onChange, subject, setSubject, preheader, setPreheader }: { design: EmailDesign; onChange: (patch: Partial<EmailDesign["settings"]>) => void; subject: string; setSubject: (v: string) => void; preheader: string; setPreheader: (v: string) => void }) {
  const s = design.settings;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-umber">Email settings</p>
      <label className="block"><span className="text-xs font-medium text-slate-600">Default subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className="text-xs font-medium text-slate-600">Preheader</span><input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Short preview text" className={inputCls} /></label>
      <label className="block"><span className="text-xs font-medium text-slate-600">Font</span><select value={s.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} className={`${inputCls} bg-white`}>{EMAIL_FONTS.map((f) => <option key={f} value={f}>{(f.split(",")[0] ?? f).replace(/'/g, "")}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-xs font-medium text-slate-600">Page bg</span><input type="color" value={s.backgroundColor} onChange={(e) => onChange({ backgroundColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
        <label className="block"><span className="text-xs font-medium text-slate-600">Content bg</span><input type="color" value={s.contentBackgroundColor} onChange={(e) => onChange({ contentBackgroundColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
        <label className="block"><span className="text-xs font-medium text-slate-600">Text color</span><input type="color" value={s.textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
        <label className="block"><span className="text-xs font-medium text-slate-600">Link color</span><input type="color" value={s.linkColor} onChange={(e) => onChange({ linkColor: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" /></label>
      </div>
      <label className="block"><span className="text-xs font-medium text-slate-600">Content width (px)</span><input type="number" min={320} max={800} value={s.contentWidth} onChange={(e) => onChange({ contentWidth: Number(e.target.value) })} className={inputCls} /></label>
    </div>
  );
}

function TestSendModal({ templateId, defaultSubject, onClose }: { templateId: string; defaultSubject: string; onClose: () => void }) {
  const toast = useToast();
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [firstName, setFirstName] = useState("Alex");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setError(null);
    try {
      const r = await testSendTemplate(templateId, { toEmail: toEmail.trim(), subject: subject.trim() || undefined, sampleValues: { firstName } });
      if (r.ok) { toast.success(r.message); onClose(); } else { setError(r.message); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "Test send failed."); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Send a test email" onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <label className="block"><span className="text-xs font-medium text-slate-600">Recipient email</span><input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="you@example.com" className={inputCls} /></label>
      <label className="mt-3 block"><span className="text-xs font-medium text-slate-600">Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></label>
      <label className="mt-3 block"><span className="text-xs font-medium text-slate-600">Sample {"{{firstName}}"}</span><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} /></label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy || !toEmail.trim()} onClick={() => void send()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Sending…" : "Send test"}</button>
      </div>
    </Modal>
  );
}
