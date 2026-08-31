"use client";

import { useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { requirementStatusTone } from "@/lib/attention";
import { REQUIREMENT_CATEGORIES, REQUIREMENT_STATUSES } from "@/lib/case-options";
import { createRequirement, updateRequirement } from "@/services/cases.service";
import { useToast } from "@/providers/toast-provider";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/states";
import type { CaseDetail, RequirementStatus } from "@/types/domain";

export function RequirementsTab({ caseDetail: c, onChange }: { caseDetail: CaseDetail; onChange: () => Promise<void> | void }) {
  const toast = useToast();
  const editable = c.editable;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ category: REQUIREMENT_CATEGORIES[0] as string, label: "", mandatory: true });
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createRequirement(c.id, { category: form.category, label: form.label, mandatory: form.mandatory });
      setForm({ category: REQUIREMENT_CATEGORIES[0], label: "", mandatory: true });
      setAdding(false);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (id: string, status: RequirementStatus) => {
    try {
      await updateRequirement(c.id, id, { status });
      toast.success("Requirement updated");
    } catch {
      toast.error("Could not update the requirement.");
    }
    await onChange();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Requirements"
        description="Track what must be resolved before discharge. Blocked or incomplete required items raise attention."
        actions={
          editable ? (
            <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              {adding ? "Cancel" : "Add requirement"}
            </button>
          ) : undefined
        }
      >
        {adding ? (
          <form onSubmit={add} className="mb-4 grid gap-3 rounded-md border border-sage bg-porcelain p-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Title</span>
              <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                {REQUIREMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{humanizeEnum(cat)}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} className="h-4 w-4 accent-brand-600" />
              Required
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Adding…" : "Add requirement"}
              </button>
            </div>
          </form>
        ) : null}

        {c.requirements.length === 0 ? (
          <EmptyState title="No requirements" message="Add the requirements that must be resolved for this case." />
        ) : (
          <ul className="divide-y divide-sage">
            {c.requirements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-slate-ink">{humanizeEnum(r.category)}</span>
                    <p className="text-sm font-medium text-umber">{r.label}</p>
                    {r.mandatory ? <span className="text-xs text-slate-400">Required</span> : null}
                  </div>
                  {r.detail ? <p className="mt-0.5 text-sm text-slate-500">{r.detail}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={humanizeEnum(r.status)} tone={requirementStatusTone(r.status)} />
                  {editable ? (
                    <select value={r.status} onChange={(e) => void changeStatus(r.id, e.target.value as RequirementStatus)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
                      {REQUIREMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{humanizeEnum(s)}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
