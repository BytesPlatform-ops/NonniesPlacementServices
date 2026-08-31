"use client";

import { useState } from "react";
import { humanizeEnum, formatDate } from "@/lib/format";
import { LEVELS_OF_CARE, SERVICE_CATEGORIES } from "@/lib/case-options";
import { cancelServiceRequest, createServiceRequest } from "@/services/cases.service";
import { MutationButton } from "@/components/ui/MutationButton";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList, type DescriptionItem } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/states";
import type { CaseDetail, ServiceRequestView } from "@/types/domain";

function requestItems(sr: ServiceRequestView): DescriptionItem[] {
  const items: DescriptionItem[] = [];
  const push = (label: string, value: string | number | null) => {
    if (value !== null && value !== "") items.push({ label, value });
  };
  push("Level of care", sr.levelOfCare ? humanizeEnum(sr.levelOfCare) : null);
  push("Requested start", sr.requestedStartDate ? formatDate(sr.requestedStartDate) : null);
  push("Frequency", sr.frequency);
  push("Duration", sr.durationText);
  push("Service area", [sr.serviceCity, sr.serviceState].filter(Boolean).join(", ") || null);
  push("Funding", sr.fundingSource);
  push("Required qualifications", sr.requiredQualifications);
  push("Equipment", sr.equipmentNeeds);
  return items;
}

export function ServiceRequestsTab({ caseDetail: c, onChange }: { caseDetail: CaseDetail; onChange: () => Promise<void> | void }) {
  const editable = c.editable;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ category: SERVICE_CATEGORIES[0] as string, levelOfCare: "", requestedStartDate: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createServiceRequest(c.id, {
        category: form.category,
        levelOfCare: form.levelOfCare || undefined,
        requestedStartDate: form.requestedStartDate || undefined,
        notes: form.notes || undefined,
      });
      setForm({ category: SERVICE_CATEGORIES[0], levelOfCare: "", requestedStartDate: "", notes: "" });
      setAdding(false);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Service requests"
      description="The post-discharge services this case requires. A provider is selected manually in a later step."
      actions={
        editable ? (
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {adding ? "Cancel" : "Add service request"}
          </button>
        ) : undefined
      }
    >
      {adding ? (
        <form onSubmit={add} className="mb-4 grid gap-3 rounded-md border border-sage bg-porcelain p-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Service category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{humanizeEnum(cat)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Level of care</span>
            <select value={form.levelOfCare} onChange={(e) => setForm({ ...form, levelOfCare: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">—</option>
              {LEVELS_OF_CARE.map((l) => (
                <option key={l} value={l}>{humanizeEnum(l)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Requested start</span>
            <input type="date" value={form.requestedStartDate} onChange={(e) => setForm({ ...form, requestedStartDate: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Adding…" : "Add service request"}
            </button>
          </div>
        </form>
      ) : null}

      {c.serviceRequests.length === 0 ? (
        <EmptyState title="No service requests" message="Add the services this case needs after discharge." />
      ) : (
        <div className="space-y-3">
          {c.serviceRequests.map((sr) => (
            <div key={sr.id} className="rounded-md border border-sage p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-umber">{humanizeEnum(sr.category)}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge label={humanizeEnum(sr.status)} tone={sr.status === "CANCELLED" ? "negative" : "neutral"} />
                  {editable && sr.status !== "CANCELLED" ? (
                    <MutationButton
                      variant="danger-link"
                      pendingLabel="Cancelling…"
                      confirm={{ title: "Cancel this service request?", description: "The service request will be marked cancelled and excluded from placement.", confirmLabel: "Cancel request", cancelLabel: "Keep request", variant: "danger" }}
                      action={() => cancelServiceRequest(c.id, sr.id)}
                      successToast="Service request cancelled"
                      onSuccess={onChange}
                    >
                      Cancel
                    </MutationButton>
                  ) : null}
                </div>
              </div>
              {requestItems(sr).length > 0 ? <div className="mt-3"><DescriptionList items={requestItems(sr)} /></div> : null}
              {sr.notes ? <p className="mt-3 text-sm text-slate-600">{sr.notes}</p> : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
