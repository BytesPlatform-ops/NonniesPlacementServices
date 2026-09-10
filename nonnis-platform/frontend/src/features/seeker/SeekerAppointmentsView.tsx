"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { MutationButton } from "@/components/ui/MutationButton";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { listSeekerAppointments, requestSeekerTour, respondToSeekerAppointment } from "@/services/seeker.service";
import type { SeekerAppointment } from "@/types/seeker";
import { appointmentTone } from "./seeker-tones";
import { useSeekerCaseId } from "./use-seeker-case";

function AppointmentCard({
  appointment,
  caseId,
  onChanged,
}: {
  appointment: SeekerAppointment;
  caseId?: string;
  onChanged: () => void;
}) {
  const a = appointment;
  // A family may only respond while an appointment is still live.
  const canRespond = !a.isPast && a.status !== "CANCELLED" && a.status !== "COMPLETED";

  return (
    <li className="rounded-lg border border-sage bg-ivory p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-umber">
            {a.typeLabel}
            {a.providerName ? ` · ${a.providerName}` : ""}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {a.scheduledAt ? formatDateTime(a.scheduledAt) : "We are still arranging a time"}
            {a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
          </p>
          {a.locationText ? <p className="mt-0.5 text-xs text-slate-500">{a.locationText}</p> : null}
        </div>
        <StatusBadge label={a.statusLabel} tone={appointmentTone(a.status)} />
      </div>

      {a.instructions ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">{a.instructions}</p>
      ) : null}
      {a.outcomeNote ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{a.outcomeNote}</p>
      ) : null}
      {a.cancelReason ? <p className="mt-3 text-xs text-slate-500">Cancelled: {a.cancelReason}</p> : null}

      {canRespond ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {a.status === "SCHEDULED" ? (
            <MutationButton
              variant="primary"
              pendingLabel="Confirming…"
              confirm={{ title: "Confirm this appointment?", description: "We will let the provider know you are coming.", confirmLabel: "Confirm" }}
              action={() => respondToSeekerAppointment(a.id, { action: "CONFIRM", caseId })}
              successToast="Appointment confirmed"
              onSuccess={onChanged}
            >
              Confirm
            </MutationButton>
          ) : null}
          <MutationButton
            variant="secondary"
            pendingLabel="Sending…"
            confirm={{ title: "Ask to reschedule?", description: "We will contact you to agree a new time.", confirmLabel: "Ask to reschedule" }}
            action={() => respondToSeekerAppointment(a.id, { action: "REQUEST_RESCHEDULE", caseId })}
            successToast="We will be in touch about a new time"
            onSuccess={onChanged}
          >
            Ask to reschedule
          </MutationButton>
          <MutationButton
            variant="danger-link"
            pendingLabel="Cancelling…"
            confirm={{
              title: "Cancel this appointment?",
              description: "Let us know if you would like to arrange another one later.",
              confirmLabel: "Cancel appointment",
              variant: "danger",
            }}
            action={() => respondToSeekerAppointment(a.id, { action: "CANCEL", caseId })}
            successToast="Appointment cancelled"
            onSuccess={onChanged}
          >
            Cancel
          </MutationButton>
        </div>
      ) : null}
    </li>
  );
}

export function SeekerAppointmentsView() {
  const caseId = useSeekerCaseId();
  const [note, setNote] = useState("");
  const state = useAsync(() => listSeekerAppointments(caseId), [caseId]);

  if (state.loading) return <LoadingState label="Loading appointments…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;

  const all = state.data ?? [];
  const upcoming = all.filter((a) => !a.isPast);
  const past = all.filter((a) => a.isPast);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Tours & Appointments"
        description="Visits and assessments arranged for your case. You can confirm, ask to move, or cancel any of them."
      />

      <Panel title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled" message="Ask for a tour below and we will arrange a time." />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} caseId={caseId} onChanged={state.reload} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Request a tour" description="Tell us when suits and we will arrange it with the provider.">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">When would suit you? (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Weekday mornings, or any afternoon after the 12th"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
          />
        </label>
        <div className="mt-3">
          <MutationButton
            variant="primary"
            pendingLabel="Requesting…"
            confirm={{ title: "Request a tour?", description: "We will arrange a time and let you know.", confirmLabel: "Request tour" }}
            action={() => requestSeekerTour({ note: note.trim() || undefined, caseId })}
            successToast="Tour requested"
            onSuccess={() => {
              setNote("");
              state.reload();
            }}
          >
            Request a tour
          </MutationButton>
        </div>
      </Panel>

      {past.length > 0 ? (
        <Panel title="Past">
          <ul className="space-y-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} caseId={caseId} onChanged={state.reload} />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
