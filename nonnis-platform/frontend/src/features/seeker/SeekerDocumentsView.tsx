"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSeekerDocumentDownload, listSeekerDocuments, uploadSeekerDocument } from "@/services/seeker.service";
import type { SeekerDocument } from "@/types/seeker";
import { documentTone } from "./seeker-tones";
import { useSeekerCaseId } from "./use-seeker-case";

/** Reads a picked file as base64, which is how the API accepts uploads. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the `data:<mime>;base64,` prefix the reader adds.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

function DocumentRow({
  doc,
  caseId,
  onChanged,
}: {
  doc: SeekerDocument;
  caseId?: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const needsUpload = doc.requestedFromSeeker && (doc.status === "REQUESTED" || doc.status === "NEEDS_UPDATE");

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const contentBase64 = await readAsBase64(file);
      await uploadSeekerDocument(
        doc.id,
        { fileName: file.name, contentType: file.type || "application/octet-stream", contentBase64 },
        caseId,
      );
      toast.success("Document uploaded");
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
      // A short-lived signed URL, fetched on demand — the file's storage
      // location is never part of the page.
      const { url } = await getSeekerDocumentDownload(doc.id, caseId);
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
            {doc.fileName
              ? `${doc.fileName}${doc.uploadedAt ? ` · uploaded ${formatDateTime(doc.uploadedAt)}` : ""}`
              : doc.dueAt
                ? `Needed by ${formatDate(doc.dueAt)}`
                : "Not uploaded yet"}
          </p>
          {doc.status === "NEEDS_UPDATE" && doc.reviewNote ? (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{doc.reviewNote}</p>
          ) : null}
        </div>
        <StatusBadge label={doc.statusLabel} tone={documentTone(doc.status)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {needsUpload ? (
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
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              {busy ? "Uploading…" : doc.status === "NEEDS_UPDATE" ? "Upload a new version" : "Upload"}
            </button>
          </>
        ) : null}
        {doc.hasFile ? (
          <button type="button" onClick={() => void download()} className="text-sm font-medium text-brand-700 hover:underline">
            Download
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function SeekerDocumentsView() {
  const caseId = useSeekerCaseId();
  const state = useAsync(() => listSeekerDocuments(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading documents…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;

  const docs = state.data ?? [];
  const needed = docs.filter((d) => d.requestedFromSeeker && (d.status === "REQUESTED" || d.status === "NEEDS_UPDATE"));
  const rest = docs.filter((d) => !needed.includes(d));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Documents"
        description="Documents we have asked you for, and documents shared with you."
      />

      <Panel
        title="Still needed"
        description={needed.length > 0 ? "Please upload these when you can." : undefined}
      >
        {needed.length === 0 ? (
          <EmptyState title="Nothing needed right now" message="We will let you know if we need anything from you." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {needed.map((d) => (
              <DocumentRow key={d.id} doc={d} caseId={caseId} onChanged={state.reload} />
            ))}
          </ul>
        )}
      </Panel>

      {rest.length > 0 ? (
        <Panel title="All documents">
          <ul className="divide-y divide-sage/70">
            {rest.map((d) => (
              <DocumentRow key={d.id} doc={d} caseId={caseId} onChanged={state.reload} />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
