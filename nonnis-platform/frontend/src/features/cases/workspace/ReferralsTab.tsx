"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { placementStatusLabel, placementStatusTone, referralStatusLabel, referralStatusTone } from "@/lib/referral-status";
import { statusTone } from "@/lib/admin-status";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listCaseReferrals,
  createReferral,
  sendReferral,
  withdrawReferral,
  provideReferralInformation,
  resendReferralNotification,
} from "@/services/referrals.service";
import { listProviders } from "@/services/providers.service";
import { listServiceCategories } from "@/services/catalog.service";
import type { CaseDetail, ServiceRequestView } from "@/types/domain";
import type { StaffReferralSummary } from "@/types/referrals";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function ReferralsTab({ caseDetail, onChange }: { caseDetail: CaseDetail; onChange: () => void }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.REFERRALS_MANAGE);
  const { data, loading, reload } = useAsync(() => listCaseReferrals(caseDetail.id), [caseDetail.id]);
  const [picker, setPicker] = useState<ServiceRequestView | null>(null);
  const [infoFor, setInfoFor] = useState<StaffReferralSummary | null>(null);

  const byService = useMemo(() => {
    const map = new Map<string, StaffReferralSummary[]>();
    for (const r of data ?? []) {
      const list = map.get(r.serviceRequestId) ?? [];
      list.push(r);
      map.set(r.serviceRequestId, list);
    }
    return map;
  }, [data]);

  const refresh = () => {
    reload();
    onChange();
  };

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    refresh();
  };

  if (loading) return <LoadingState label="Loading referrals…" />;

  return (
    <div className="space-y-6">
      {caseDetail.serviceRequests.length === 0 ? (
        <Panel><EmptyState title="No service requests" message="Add a service request before creating referrals." /></Panel>
      ) : (
        caseDetail.serviceRequests.map((sr) => {
          const referrals = byService.get(sr.id) ?? [];
          return (
            <Panel
              key={sr.id}
              title={humanizeEnum(sr.category)}
              description={sr.levelOfCare ? humanizeEnum(sr.levelOfCare) : undefined}
              actions={
                canManage ? (
                  <button type="button" onClick={() => setPicker(sr)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                    Find provider
                  </button>
                ) : undefined
              }
            >
              {referrals.length === 0 ? (
                <p className="text-sm text-slate-500">No referrals yet for this service.</p>
              ) : (
                <ul className="space-y-3">
                  {referrals.map((r) => (
                    <li key={r.id} className="rounded-md border border-sage/70 bg-cream/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs text-slate-500">{r.reference}</span>
                          <p className="font-medium text-slate-800">{r.provider.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge label={referralStatusLabel(r.status)} tone={referralStatusTone(r.status)} />
                          {r.placementStatus ? <StatusBadge label={placementStatusLabel(r.placementStatus)} tone={placementStatusTone(r.placementStatus)} /> : null}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.sentAt ? `Sent ${formatDate(r.sentAt)}` : "Not sent"}
                        {r.responseDueAt ? ` · Due ${formatDate(r.responseDueAt)}` : ""}
                        {r.viewedAt ? ` · Viewed ${formatDateTime(r.viewedAt)}` : ""}
                        {r.notificationStatus !== "NOT_SENT" ? ` · Email ${r.notificationStatus.toLowerCase()}` : ""}
                      </p>
                      {canManage ? (
                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                          {r.status === "DRAFT" ? <button type="button" onClick={() => void act(() => sendReferral(r.id))} className="font-medium text-brand-700 hover:underline">Send</button> : null}
                          {r.status === "INFORMATION_REQUESTED" ? <button type="button" onClick={() => setInfoFor(r)} className="font-medium text-brand-700 hover:underline">Provide information</button> : null}
                          {r.notificationStatus === "FAILED" ? <button type="button" onClick={() => void act(() => resendReferralNotification(r.id))} className="text-slate-500 hover:text-umber">Resend email</button> : null}
                          {!["DECLINED", "WITHDRAWN", "CANCELLED", "ACCEPTED"].includes(r.status) ? <button type="button" onClick={() => void act(() => withdrawReferral(r.id))} className="text-rose-600 hover:underline">Withdraw</button> : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })
      )}

      {picker ? (
        <ProviderPickerModal
          caseId={caseDetail.id}
          serviceRequest={picker}
          onClose={() => setPicker(null)}
          onDone={() => { setPicker(null); refresh(); }}
        />
      ) : null}
      {infoFor ? (
        <InfoModal
          referralId={infoFor.id}
          onClose={() => setInfoFor(null)}
          onDone={() => { setInfoFor(null); refresh(); }}
        />
      ) : null}
    </div>
  );
}

function ProviderPickerModal({ caseId, serviceRequest, onClose, onDone }: { caseId: string; serviceRequest: ServiceRequestView; onClose: () => void; onDone: () => void }) {
  const categories = useAsync(() => listServiceCategories({ activeOnly: true, pageSize: 100 }), []);
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState(serviceRequest.serviceState ?? "");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the visible service-category filter from the service request's category.
  useEffect(() => {
    const match = (categories.data?.items ?? []).find((c) => c.code === serviceRequest.category);
    if (match) setServiceCategoryId(match.id);
  }, [categories.data, serviceRequest.category]);

  const filters = useMemo(
    () => ({ pageSize: 20, q: search || undefined, serviceCategoryId: serviceCategoryId || undefined, state: state || undefined, status: "ACTIVE" }),
    [search, serviceCategoryId, state],
  );
  const providers = useAsync(() => listProviders(filters), [filters]);

  const refer = async (sendNow: boolean) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await createReferral(caseId, serviceRequest.id, {
        providerId: selected.id,
        sendNow,
        responseDueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the referral.");
      setBusy(false);
    }
  };

  return (
    <Modal title={`Find a provider — ${humanizeEnum(serviceRequest.category)}`} onClose={onClose} size="lg">
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {!selected ? (
        <>
          <p className="mb-3 text-xs text-slate-500">Provider selection is manual. Adjust the visible filters and choose a provider.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} /></label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Service category</span>
              <select value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Any</option>
                {(categories.data?.items ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </label>
            <label className="block"><span className="text-xs font-medium text-slate-600">State</span><input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} /></label>
          </div>
          <div className="mt-4 max-h-72 overflow-y-auto">
            {providers.loading ? (
              <LoadingState label="Loading providers…" />
            ) : !providers.data || providers.data.items.length === 0 ? (
              <EmptyState title="No providers" message="No providers match these filters." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {providers.data.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-medium text-slate-800">{p.displayName}</p>
                      <p className="text-xs text-slate-500">{[p.city, p.state].filter(Boolean).join(", ") || "—"} · {p.servicesCount} services</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={humanizeEnum(p.status)} tone={statusTone(p.status)} />
                      <button type="button" onClick={() => setSelected({ id: p.id, name: p.displayName })} className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-700">Select</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Refer to <strong>{selected.name}</strong>?</p>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Response due date (optional)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" disabled={busy} onClick={() => void refer(false)} className="rounded-md border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60">Save as draft</button>
            <button type="button" disabled={busy} onClick={() => void refer(true)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Sending…" : "Send referral"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoModal({ referralId, onClose, onDone }: { referralId: string; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await provideReferralInformation(referralId, message);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send information.");
      setBusy(false);
    }
  };
  return (
    <Modal title="Provide requested information" onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Information for the provider</span>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy || !message.trim()} onClick={() => void submit()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
      </div>
    </Modal>
  );
}
