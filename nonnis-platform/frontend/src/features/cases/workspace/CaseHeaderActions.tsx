"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { caseStatusMeta } from "@/lib/case-status";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { assignCase, transitionCase } from "@/services/cases.service";
import { listUsers } from "@/services/admin.service";
import { Panel } from "@/components/ui/Panel";
import type { CaseDetail } from "@/types/domain";

export function CaseHeaderActions({
  caseDetail,
  canAssign,
  onChange,
}: {
  caseDetail: CaseDetail;
  canAssign: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Array<{ code: string; label: string }>>([]);

  const users = useAsync(() => (canAssign ? listUsers({ page: 1 }) : Promise.resolve(null)), [canAssign]);

  if (!caseDetail.editable && caseDetail.allowedTransitions.length === 0 && !canAssign) {
    return null;
  }

  const runTransition = async (toStatus: (typeof caseDetail.allowedTransitions)[number]) => {
    if (toStatus === "CANCELLED" && !window.confirm("Cancel this case? This cannot be undone here.")) return;
    setBusy(true);
    setError(null);
    setBlockers([]);
    try {
      await transitionCase(caseDetail.id, toStatus);
      await onChange();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        const details = e.details as { blockers?: Array<{ code: string; label: string }> } | undefined;
        setBlockers(details?.blockers ?? []);
      } else {
        setError("Could not change the status.");
      }
    } finally {
      setBusy(false);
    }
  };

  const runAssign = async (userId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await assignCase(caseDetail.id, userId);
      await onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3">
        {caseDetail.allowedTransitions.map((s) => {
          const meta = caseStatusMeta(s);
          const cancel = s === "CANCELLED";
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void runTransition(s)}
              className={
                cancel
                  ? "rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  : "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              }
            >
              Move to {meta.label}
            </button>
          );
        })}

        {canAssign ? (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">Assign</span>
            <select
              value={caseDetail.assignedDischargeProfessional?.id ?? ""}
              disabled={busy || users.loading}
              onChange={(e) => void runAssign(e.target.value || null)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              <option value="">Unassigned</option>
              {(users.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {error}
          </p>
          {blockers.length > 0 ? (
            <ul className="mt-1.5 list-inside list-disc text-rose-700/90">
              {blockers.map((b) => (
                <li key={b.code}>{b.label}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
