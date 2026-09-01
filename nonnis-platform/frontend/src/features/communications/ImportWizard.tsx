"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, Table, Upload } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { commitImport, inspectCsv, listOptions, previewImport } from "@/services/communications.service";
import type { CsvMapping, ImportCommitResult, ImportPreviewResult, ImportRequest, ImportSourceType } from "@/types/communications";
import { IMPORT_STATUS_LABEL, importStatusTone } from "./labels";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const COUNTRIES = [{ code: "US", label: "United States (+1)" }, { code: "CA", label: "Canada (+1)" }, { code: "GB", label: "United Kingdom (+44)" }, { code: "AU", label: "Australia (+61)" }, { code: "MX", label: "Mexico (+52)" }];
const MAP_FIELDS: Array<{ key: keyof CsvMapping; label: string }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "organization", label: "Organization" },
];
const MAX_BYTES = 5 * 1024 * 1024;

export function ImportWizard() {
  const toast = useToast();
  const confirm = useConfirm();
  const lists = useAsync(() => listOptions(), []);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sourceType, setSourceType] = useState<ImportSourceType>("PASTE");
  const [mode, setMode] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [defaultCountry, setDefaultCountry] = useState("US");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [listChoice, setListChoice] = useState<"none" | "existing" | "new">("none");
  const [listId, setListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [updateEmptyOnly, setUpdateEmptyOnly] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(1); setSourceType("PASTE"); setMode("EMAIL"); setContent(""); setFilename(null); setCsvHeaders([]); setMapping({});
    setListChoice("none"); setListId(""); setNewListName(""); setTagsText(""); setUpdateEmptyOnly(false); setPreview(null); setResult(null); setError(null);
  };

  const readFile = (file: File) => {
    const lower = file.name.toLowerCase();
    const okExt = sourceType === "CSV" ? lower.endsWith(".csv") : lower.endsWith(".txt");
    if (!okExt) { setError(`Choose a ${sourceType} file (.${sourceType === "CSV" ? "csv" : "txt"}).`); return; }
    if (file.size > MAX_BYTES) { setError("File exceeds the 5 MB limit."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      setContent(text); setFilename(file.name); setError(null);
      if (sourceType === "CSV") {
        try { const r = await inspectCsv(text); setCsvHeaders(r.headers); } catch { setError("Could not read the CSV headers."); }
      }
    };
    reader.readAsText(file);
  };

  const buildRequest = (): ImportRequest => {
    const req: ImportRequest = { sourceType, content, defaultCountry, updateEmptyOnly };
    if (sourceType !== "CSV") req.mode = mode;
    if (sourceType === "CSV") {
      const m: CsvMapping = {};
      for (const f of MAP_FIELDS) if (mapping[f.key] !== undefined && mapping[f.key] !== "") m[f.key] = Number(mapping[f.key]);
      req.mapping = m;
    }
    return req;
  };

  const runPreview = async () => {
    setBusy(true); setError(null);
    try {
      const p = await previewImport(buildRequest());
      setPreview(p);
      setStep(3);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not build the preview."); }
    finally { setBusy(false); }
  };

  const runCommit = async () => {
    if (!preview) return;
    if (preview.counts.new > 500) {
      const ok = await confirm({ title: "Import contacts?", description: `${preview.counts.new} new contacts will be created. Duplicates, invalid rows, conflicts and suppressed addresses are skipped.`, confirmLabel: "Import" });
      if (!ok) return;
    }
    setBusy(true); setError(null);
    try {
      const req = buildRequest();
      req.originalFilename = filename ?? undefined;
      if (listChoice === "existing" && listId) req.listId = listId;
      if (listChoice === "new" && newListName.trim()) req.newListName = newListName.trim();
      const tagNames = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagNames.length) req.tagNames = tagNames;
      const r = await commitImport(req);
      setResult(r);
      setStep(4);
      toast.success(`Imported ${r.importedCount} contact${r.importedCount === 1 ? "" : "s"}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Import failed."); }
    finally { setBusy(false); }
  };

  const downloadErrors = () => {
    if (!preview) return;
    const rows = preview.problemRows.map((r) => [r.row, r.firstName, r.lastName, r.email, r.phone, r.organization, IMPORT_STATUS_LABEL[r.status], r.issue]);
    downloadCsv("nonnis-contact-import-errors.csv", toCsv(["Row", "First", "Last", "Email", "Phone", "Organization", "Status", "Reason"], rows));
  };

  const canConfigure = sourceType === "PASTE" ? content.trim().length > 0 : content.length > 0 && (sourceType !== "CSV" || csvHeaders.length > 0);
  const csvMappedOk = sourceType !== "CSV" || mapping.email !== undefined || mapping.phone !== undefined;

  return (
    <div className="space-y-4">
      <PageHeading title="Import contacts" description="Paste, or upload a CSV/TXT. Nothing is inserted until you review the preview and confirm." />

      <Steps step={step} />

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {step === 1 ? (
        <Panel title="1 · Choose a source">
          <div className="grid gap-3 sm:grid-cols-3">
            <SourceCard icon={<ClipboardList className="h-5 w-5" />} label="Paste" desc="Paste emails or phone numbers" active={sourceType === "PASTE"} onClick={() => { setSourceType("PASTE"); setContent(""); setFilename(null); }} />
            <SourceCard icon={<Table className="h-5 w-5" />} label="CSV file" desc="Full contact rows with column mapping" active={sourceType === "CSV"} onClick={() => { setSourceType("CSV"); setContent(""); setFilename(null); }} />
            <SourceCard icon={<FileText className="h-5 w-5" />} label="TXT file" desc="One email or phone per line" active={sourceType === "TXT"} onClick={() => { setSourceType("TXT"); setContent(""); setFilename(null); }} />
          </div>

          <div className="mt-5">
            {sourceType === "PASTE" ? (
              <div>
                <div className="flex gap-2">
                  {(["EMAIL", "PHONE"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-full border px-3 py-1 text-xs font-medium ${mode === m ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600"}`}>{m === "EMAIL" ? "Emails" : "Phone numbers"}</button>
                  ))}
                </div>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder={mode === "EMAIL" ? "john@example.com\njane@example.com" : "(555) 123-4567\n(555) 987-6543"} className={`${inputCls} mt-3 font-mono`} />
              </div>
            ) : (
              <FileDrop sourceType={sourceType} filename={filename} onFile={readFile} />
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" disabled={!canConfigure} onClick={() => setStep(2)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Continue</button>
          </div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="2 · Configuration">
          {sourceType === "CSV" ? (
            <div>
              <p className="text-sm text-slate-600">Map your CSV columns. Map at least an Email or Phone.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MAP_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs font-medium text-slate-600">{f.label}</span>
                    <select value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} className={`${inputCls} bg-white`}>
                      <option value="">— Skip —</option>
                      {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">These values are</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as "EMAIL" | "PHONE")} className={`${inputCls} bg-white`}>
                  <option value="EMAIL">Emails</option>
                  <option value="PHONE">Phone numbers</option>
                </select>
              </label>
            </div>
          )}

          {(sourceType === "CSV" && mapping.phone !== undefined) || (sourceType !== "CSV" && mode === "PHONE") ? (
            <label className="mt-3 block max-w-xs">
              <span className="text-xs font-medium text-slate-600">Default country (for numbers without a prefix)</span>
              <select value={defaultCountry} onChange={(e) => setDefaultCountry(e.target.value)} className={`${inputCls} bg-white`}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-slate-600">Add imported contacts to a list</span>
              <select value={listChoice} onChange={(e) => setListChoice(e.target.value as "none" | "existing" | "new")} className={`${inputCls} bg-white`}>
                <option value="none">Don&apos;t add to a list</option>
                <option value="existing">Existing list</option>
                <option value="new">Create a new list</option>
              </select>
              {listChoice === "existing" ? (
                <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputCls} mt-2 bg-white`}>
                  <option value="">Select a list…</option>
                  {(lists.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : null}
              {listChoice === "new" ? <input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="New list name" className={`${inputCls} mt-2`} /> : null}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Tags (comma-separated)</span>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="hospital-outreach, september" className={inputCls} />
              <span className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={updateEmptyOnly} onChange={(e) => setUpdateEmptyOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                Update empty fields on existing contacts
              </span>
            </label>
          </div>

          <div className="mt-5 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy || !csvMappedOk} onClick={() => void runPreview()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Validating…" : "Preview"}</button>
          </div>
        </Panel>
      ) : null}

      {step === 3 && preview ? (
        <Panel title="3 · Preview" description={preview.truncated ? "Showing a sample of rows." : undefined}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Counter label="Total" value={preview.counts.total} />
            <Counter label="New" value={preview.counts.new} tone="text-emerald-700" />
            <Counter label="Duplicate" value={preview.counts.duplicate} />
            <Counter label="Invalid" value={preview.counts.invalid} tone="text-rose-700" />
            <Counter label="Conflict" value={preview.counts.conflict} tone="text-amber-700" />
            <Counter label="Suppressed" value={preview.counts.suppressed} tone="text-amber-700" />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>{["Row", "Name", "Email", "Phone", "Organization", "Status", "Issue"].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.sampleRows.map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-2 text-slate-500">{r.row}</td>
                    <td className="px-3 py-2">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2">{r.email ?? "—"}</td>
                    <td className="px-3 py-2">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2">{r.organization ?? "—"}</td>
                    <td className="px-3 py-2"><StatusBadge label={IMPORT_STATUS_LABEL[r.status]} tone={importStatusTone(r.status)} /></td>
                    <td className="px-3 py-2 text-slate-500">{r.issue ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
              {preview.problemRows.length > 0 ? <button type="button" onClick={downloadErrors} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Download problem rows</button> : null}
            </div>
            <button type="button" disabled={busy || preview.counts.new === 0} onClick={() => void runCommit()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? "Importing…" : `Import ${preview.counts.new} contact${preview.counts.new === 1 ? "" : "s"}`}
            </button>
          </div>
        </Panel>
      ) : null}

      {step === 4 && result ? (
        <Panel title="4 · Import complete">
          <p className="text-lg font-semibold text-umber">Imported {result.importedCount} contact{result.importedCount === 1 ? "" : "s"}.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Counter label="Total" value={result.total} />
            <Counter label="Imported" value={result.importedCount} tone="text-emerald-700" />
            <Counter label="Duplicate" value={result.duplicate} />
            <Counter label="Invalid" value={result.invalid} tone="text-rose-700" />
            <Counter label="Conflict" value={result.conflict} tone="text-amber-700" />
            <Counter label="Suppressed" value={result.suppressed} tone="text-amber-700" />
          </div>
          <div className="mt-5 flex gap-2">
            <Link href="/communications/contacts" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">View contacts</Link>
            <button type="button" onClick={reset} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Import another</button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Source", "Configure", "Preview", "Result"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${i + 1 <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
          <span className={i + 1 === step ? "font-medium text-umber" : "text-slate-500"}>{l}</span>
          {i < labels.length - 1 ? <span className="mx-1 h-px w-6 bg-slate-300" /> : null}
        </div>
      ))}
    </div>
  );
}

function SourceCard({ icon, label, desc, active, onClick }: { icon: React.ReactNode; label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors ${active ? "border-brand-600 bg-brand-50" : "border-slate-300 hover:border-brand-400"}`}>
      <span className={active ? "text-brand-700" : "text-slate-500"}>{icon}</span>
      <span className="font-medium text-umber">{label}</span>
      <span className="text-xs text-slate-500">{desc}</span>
    </button>
  );
}

function FileDrop({ sourceType, filename, onFile }: { sourceType: ImportSourceType; filename: string | null; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"}`}
    >
      <Upload className="h-6 w-6 text-slate-400" aria-hidden />
      <span className="text-sm font-medium text-slate-600">{filename ?? `Drop a ${sourceType} file here, or browse`}</span>
      <span className="text-xs text-slate-400">{sourceType === "CSV" ? ".csv" : ".txt"} · up to 5 MB · the file itself is never stored</span>
      <input type="file" accept={sourceType === "CSV" ? ".csv,text/csv" : ".txt,text/plain"} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-sage bg-ivory px-3 py-2 text-center shadow-card">
      <p className={`text-xl font-semibold tabular-nums ${tone ?? "text-umber"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
