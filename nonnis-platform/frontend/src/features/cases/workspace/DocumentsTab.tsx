"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { MutationButton } from "@/components/ui/MutationButton";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createCaseDocument,
  getCaseDocumentDownload,
  listCaseDocuments,
  reviewCaseDocument,
  uploadCaseDocument,
  type CaseDocument,
} from "@/services/case-documents.service";
import { documentTone } from "@/features/seeker/seeker-tones";
import type { CaseDetail } from "@/types/domain";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

function Row({
  caseId,
  doc,
  canManage,
  onChanged,
}: {
  caseId: string;
  doc: CaseDocument;
  canManage: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const contentBase64 = await readAsBase64(file);
      await uploadCaseDocument(caseId, doc.id, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        contentBase64,
      });
      toast.success("File uploaded");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async () => {
    try {
      const { url } = await getCaseDocumentDownload(caseId, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file could not be opened.");
    }
  };

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-umber">{doc.title}</p>
          {doc.description ? <p className="mt-0.5 text-xs text-slate-500">{doc.description}</p> : null}
          <p className="mt-1 text-xs text-slate-400">
            {doc.requestedFromSeeker ? "Requested from the family · " : ""}
            {doc.visibility === "CARE_SEEKER" ? "Visible to the family" : "Staff only"}
            {doc.dueAt ? ` · due ${formatDate(doc.dueAt)}` : ""}
            {doc.uploadedAt ? ` · uploaded ${formatDateTime(doc.uploadedAt)}` : ""}
          </p>
          {doc.reviewNote ? <p className="mt-1.5 text-xs text-slate-600">Review note: {doc.reviewNote}</p> : null}
        </div>
        <StatusBadge label={doc.statusLabel} tone={documentTone(doc.status)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {doc.hasFile ? (
          <button type="button" onClick={() => void download()} className="text-sm font-medium text-brand-700 hover:underline">
            Download
          </button>
        ) : null}
        {canManage ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-umber disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              {busy ? "Uploading…" : doc.hasFile ? "Replace file" : "Upload file"}
            </button>
            {doc.status === "UPLOADED" ? (
              <>
                <MutationButton
                  variant="primary"
                  pendingLabel="Accepting…"
                  action={() => reviewCaseDocument(caseId, doc.id, { status: "ACCEPTED" })}
                  successToast="Document accepted"
                  onSuccess={onChanged}
                >
                  Accept
                </MutationButton>
                <button
                  type="button"
                  onClick={() => setShowReject((v) => !v)}
                  className="text-sm font-medium text-rose-600 hover:underline"
                >
                  Ask for an update
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {showReject ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50/60 p-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">What needs to change? (the family will see this)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} />
          </label>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setShowReject(false)} className="text-sm font-medium text-slate-500">
              Cancel
            </button>
            <MutationButton
              variant="danger"
              pendingLabel="Sending…"
              disabled={note.trim().length === 0}
              action={() => reviewCaseDocument(caseId, doc.id, { status: "NEEDS_UPDATE", reviewNote: note.trim() })}
              successToast="Update requested"
              onSuccess={() => {
                setNote("");
                setShowReject(false);
                onChanged();
              }}
            >
              Request update
            </MutationButton>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function DocumentsTab({ caseDetail }: { caseDetail: CaseDetail }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CASE_DOCUMENTS_MANAGE);
  const state = useAsync(() => listCaseDocuments(caseDetail.id), [caseDetail.id]);
  const [form, setForm] = useState({ title: "", description: "", requestedFromSeeker: true, dueAt: "" });

  return (
    <div className="space-y-4">
      {canManage ? (
        <Panel title="Request or add a document" description="Requesting from the family makes it visible in their portal.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Insurance card"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Needed by (optional)</span>
              <input
                type="date"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Instructions for the family (optional)</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.requestedFromSeeker}
                onChange={(e) => setForm((f) => ({ ...f, requestedFromSeeker: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Ask the family to provide this</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <MutationButton
              variant="primary"
              pendingLabel="Adding…"
              disabled={form.title.trim().length === 0}
              action={() =>
                createCaseDocument(caseDetail.id, {
                  title: form.title.trim(),
                  description: form.description.trim() || undefined,
                  requestedFromSeeker: form.requestedFromSeeker,
                  dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
                })
              }
              successToast="Document added"
              onSuccess={() => {
                setForm({ title: "", description: "", requestedFromSeeker: true, dueAt: "" });
                state.reload();
              }}
            >
              Add document
            </MutationButton>
          </div>
        </Panel>
      ) : null}

      <Panel title="Documents">
        {state.loading ? (
          <LoadingState label="Loading documents…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.length ?? 0) === 0 ? (
          <EmptyState title="No documents yet" message="Request one from the family, or upload one for the case." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {state.data?.map((d) => (
              <Row key={d.id} caseId={caseDetail.id} doc={d} canManage={canManage} onChanged={state.reload} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
