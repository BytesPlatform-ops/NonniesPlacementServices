"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { submissionStatusLabel, submissionStatusTone } from "@/lib/form-submission-status";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getFormSubmission,
  listFormSubmissions,
  updateFormSubmission,
  type FormSubmissionFilters,
} from "@/services/form-submissions.service";
import type { FormSubmissionDetail, FormSubmissionSummary, SubmissionSection } from "@/types/form-submissions";
import { FORM_SUBMISSION_STATUSES } from "@/types/form-submissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const FORM_OPTIONS = [
  { key: "hospital_referral", name: "Hospital Referral" },
  { key: "provider", name: "Provider Form" },
  { key: "find_community", name: "Find Community" },
  { key: "care_profile", name: "Care Profile" },
  { key: "home_care_inquiry", name: "Home Care Inquiry" },
  { key: "contact", name: "Contact Form" },
];

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function FormSubmissionsView() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [formKey, setFormKey] = useState("");
  const [status, setStatus] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, formKey, status, reviewed, dateFrom, dateTo]);

  const filters: FormSubmissionFilters = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: debounced || undefined,
      formKey: formKey || undefined,
      status: status || undefined,
      reviewed: reviewed === "" ? undefined : reviewed === "reviewed",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [page, debounced, formKey, status, reviewed, dateFrom, dateTo],
  );

  const { data, loading, error, reload } = useAsync(() => listFormSubmissions(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<FormSubmissionSummary>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => (
        <button type="button" onClick={() => setOpenId(row.id)} className="font-mono text-xs font-medium text-brand-800 hover:underline">
          {row.reference}
        </button>
      ),
    },
    { key: "form", header: "Form", render: (row) => <span className="text-slate-700">{row.formName}</span> },
    { key: "by", header: "Submitted by", render: (row) => row.submitterName ?? row.submitterEmail ?? "—" },
    { key: "contact", header: "Contact", render: (row) => row.submitterEmail ?? row.submitterPhone ?? "—" },
    { key: "submitted", header: "Submitted", render: (row) => formatDate(row.submittedAt) },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={submissionStatusLabel(row.status)} tone={submissionStatusTone(row.status)} /> },
    { key: "action", header: "", align: "right", render: (row) => <button type="button" onClick={() => setOpenId(row.id)} className="text-sm font-medium text-brand-700 hover:underline">View</button> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Website form submissions" description="Submissions from the public Nonni's website. Email and PDF delivery are unchanged; this is an additional record." />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, name, email, phone…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Form</span>
            <select value={formKey} onChange={(e) => setFormKey(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any form</option>
              {FORM_OPTIONS.map((f) => (<option key={f.key} value={f.key}>{f.name}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {FORM_SUBMISSION_STATUSES.map((s) => (<option key={s} value={s}>{submissionStatusLabel(s)}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Reviewed</span>
            <select value={reviewed} onChange={(e) => setReviewed(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any</option>
              <option value="reviewed">Reviewed</option>
              <option value="unreviewed">Unreviewed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </label>
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <LoadingState label="Loading submissions…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No submissions" message="No website form submissions match the current filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} submission{data.total === 1 ? "" : "s"}</span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      {openId ? (
        <SubmissionDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onUpdated={() => reload()}
        />
      ) : null}
    </div>
  );
}

function SubmissionDrawer({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated: () => void }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.FORM_SUBMISSIONS_MANAGE);
  const { data, loading, error, reload } = useAsync(() => getFormSubmission(id), [id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Submission detail" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-porcelain shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sage bg-ivory px-5 py-3">
          <h2 className="font-mono text-sm font-semibold text-umber">{data?.reference ?? "Submission"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        <div className="space-y-5 p-5">
          {loading ? (
            <LoadingState label="Loading submission…" />
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : data ? (
            <DrawerBody detail={data} canManage={canManage} onSaved={() => { reload(); onUpdated(); }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DrawerBody({ detail, canManage, onSaved }: { detail: FormSubmissionDetail; canManage: boolean; onSaved: () => void }) {
  const sections = ((detail.submittedData as { sections?: SubmissionSection[] })?.sections) ?? [];

  return (
    <>
      <Panel title="Summary">
        <DescriptionList
          items={[
            { label: "Form", value: detail.formName },
            { label: "Status", value: <StatusBadge label={submissionStatusLabel(detail.status)} tone={submissionStatusTone(detail.status)} /> },
            { label: "Submitted", value: formatDateTime(detail.submittedAt) },
            { label: "Source page", value: detail.sourcePage ?? "—" },
          ]}
        />
      </Panel>

      <Panel title="Contact">
        <DescriptionList
          items={[
            { label: "Name", value: detail.submitterName ?? "—" },
            { label: "Email", value: detail.submitterEmail ?? "—" },
            { label: "Phone", value: detail.submitterPhone ?? "—" },
          ]}
        />
      </Panel>

      {sections.length > 0 ? (
        <Panel title="Form responses">
          <div className="space-y-5">
            {sections.map((section, i) => (
              <div key={`${section.title}-${i}`}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{section.title}</p>
                <DescriptionList items={section.fields.map((f) => ({ label: f.label, value: f.value || "—" }))} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="Processing">
        <DescriptionList
          items={[
            { label: "Email", value: detail.emailStatus ?? "—" },
            { label: "PDF report", value: detail.reportGenerated ? "Generated" : "—" },
            { label: "Attachments", value: String(detail.attachmentsCount) },
            { label: "Documents attached", value: detail.documentGenerated ? "Yes" : "No" },
          ]}
        />
      </Panel>

      <ReviewPanel detail={detail} canManage={canManage} onSaved={onSaved} />
    </>
  );
}

function ReviewPanel({ detail, canManage, onSaved }: { detail: FormSubmissionDetail; canManage: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState(detail.status);
  const [notes, setNotes] = useState(detail.internalNotes ?? "");
  const [relatedCaseId, setRelatedCaseId] = useState(detail.relatedCaseId ?? "");
  const [relatedProviderId, setRelatedProviderId] = useState(detail.relatedProviderId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateFormSubmission(detail.id, {
        status,
        internalNotes: notes,
        relatedCaseId: relatedCaseId || null,
        relatedProviderId: relatedProviderId || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Internal review">
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {detail.reviewedByName ? (
        <p className="mb-3 text-xs text-slate-500">Last reviewed by {detail.reviewedByName} · {formatDateTime(detail.reviewedAt)}</p>
      ) : null}
      {canManage ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} bg-white`}>
              {FORM_SUBMISSION_STATUSES.map((s) => (<option key={s} value={s}>{submissionStatusLabel(s)}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Internal notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Link case ID (optional)</span>
              <input value={relatedCaseId} onChange={(e) => setRelatedCaseId(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Link provider ID (optional)</span>
              <input value={relatedProviderId} onChange={(e) => setRelatedProviderId(e.target.value)} className={inputCls} />
            </label>
          </div>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Save review"}
          </button>
        </div>
      ) : (
        <DescriptionList
          items={[
            { label: "Status", value: submissionStatusLabel(detail.status) },
            { label: "Notes", value: detail.internalNotes ?? "—" },
          ]}
        />
      )}
    </Panel>
  );
}
