"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { MutationButton } from "@/components/ui/MutationButton";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createCaseAppointment,
  listCaseAppointments,
  updateCaseAppointment,
  type CaseAppointment,
} from "@/services/case-appointments.service";
import { appointmentTone } from "@/features/seeker/seeker-tones";
import type { CaseDetail } from "@/types/domain";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800";
const TYPES = ["TOUR", "ASSESSMENT", "MEETING", "MOVE_IN", "OTHER"] as const;

function Row({
  caseId,
  appointment,
  canManage,
  onChanged,
}: {
  caseId: string;
  appointment: CaseAppointment;
  canManage: boolean;
  onChanged: () => void;
}) {
  const a = appointment;
  const [when, setWhen] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  // A family request, or a reschedule they asked for, is what staff act on.
  const needsTime = a.status === "REQUESTED" || a.status === "RESCHEDULE_REQUESTED";

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-umber">
            {a.typeLabel}
            {a.providerName ? ` · ${a.providerName}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {a.scheduledAt ? formatDateTime(a.scheduledAt) : "No time set"}
            {a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
            {a.locationText ? ` · ${a.locationText}` : ""}
          </p>
          {a.seekerNote ? <p className="mt-1.5 text-xs text-slate-600">Family note: {a.seekerNote}</p> : null}
          {a.outcomeNote ? <p className="mt-1 text-xs text-slate-600">Outcome: {a.outcomeNote}</p> : null}
          {a.cancelReason ? <p className="mt-1 text-xs text-slate-500">Cancelled: {a.cancelReason}</p> : null}
        </div>
        <StatusBadge label={a.statusLabel} tone={appointmentTone(a.status)} />
      </div>

      {canManage && !a.isPast ? (
        <div className="mt-3 space-y-3">
          {needsTime ? (
            <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Set a time</span>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
              </label>
              <MutationButton
                variant="primary"
                pendingLabel="Scheduling…"
                disabled={!when}
                action={() => updateCaseAppointment(caseId, a.id, { scheduledAt: new Date(when).toISOString() })}
                successToast="Appointment scheduled"
                onSuccess={() => {
                  setWhen("");
                  onChanged();
                }}
              >
                Schedule
              </MutationButton>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-[16rem]">
              <span className="text-xs font-medium text-slate-600">Outcome note (the family will see this)</span>
              <input value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls} />
            </label>
            <MutationButton
              variant="secondary"
              pendingLabel="Completing…"
              action={() =>
                updateCaseAppointment(caseId, a.id, {
                  status: "COMPLETED",
                  outcomeNote: outcome.trim() || undefined,
                })
              }
              successToast="Marked completed"
              onSuccess={() => {
                setOutcome("");
                onChanged();
              }}
            >
              Mark completed
            </MutationButton>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-[16rem]">
              <span className="text-xs font-medium text-slate-600">Cancellation reason</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
            </label>
            <MutationButton
              variant="danger"
              pendingLabel="Cancelling…"
              disabled={reason.trim().length === 0}
              confirm={{ title: "Cancel this appointment?", confirmLabel: "Cancel appointment", variant: "danger" }}
              action={() => updateCaseAppointment(caseId, a.id, { status: "CANCELLED", cancelReason: reason.trim() })}
              successToast="Appointment cancelled"
              onSuccess={() => {
                setReason("");
                onChanged();
              }}
            >
              Cancel
            </MutationButton>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function AppointmentsTab({ caseDetail }: { caseDetail: CaseDetail }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CASE_APPOINTMENTS_MANAGE);
  const state = useAsync(() => listCaseAppointments(caseDetail.id), [caseDetail.id]);
  const [form, setForm] = useState({ type: "TOUR", scheduledAt: "", locationText: "", instructions: "" });

  return (
    <div className="space-y-4">
      {canManage ? (
        <Panel title="Schedule a tour or appointment" description="A time makes it visible to the family as scheduled.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={inputCls}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase().replace("_", "-")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Date &amp; time (optional)</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Where (optional)</span>
              <input
                value={form.locationText}
                onChange={(e) => setForm((f) => ({ ...f, locationText: e.target.value }))}
                placeholder="Falls back to the provider's address"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Instructions for the family (optional)</span>
              <input
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                className={inputCls}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <MutationButton
              variant="primary"
              pendingLabel="Adding…"
              action={() =>
                createCaseAppointment(caseDetail.id, {
                  type: form.type,
                  scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
                  locationText: form.locationText.trim() || undefined,
                  instructions: form.instructions.trim() || undefined,
                })
              }
              successToast="Appointment added"
              onSuccess={() => {
                setForm({ type: "TOUR", scheduledAt: "", locationText: "", instructions: "" });
                state.reload();
              }}
            >
              Add appointment
            </MutationButton>
          </div>
        </Panel>
      ) : null}

      <Panel title="Tours & appointments">
        {state.loading ? (
          <LoadingState label="Loading appointments…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.length ?? 0) === 0 ? (
          <EmptyState title="Nothing scheduled" message="Add a tour or assessment for this case." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {state.data?.map((a) => (
              <Row key={a.id} caseId={caseDetail.id} appointment={a} canManage={canManage} onChanged={state.reload} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
