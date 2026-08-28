"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { placementStatusLabel, placementStatusTone, referralStatusLabel, referralStatusTone } from "@/lib/referral-status";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { listReferralMessages, sendReferralMessage } from "@/services/messages.service";
import { MessageThread } from "@/features/messages/MessageThread";
import { useAsync } from "@/hooks/use-async";
import {
  confirmReferralStart,
  getProviderReferral,
  reportUnsuccessfulStart,
  respondReferral,
  scheduleProviderPlacement,
  type RespondBody,
} from "@/services/provider-referrals.service";
import { DECLINE_REASONS, SERVICE_START_FAILURE_REASONS, type ProviderReferralDetail as Detail } from "@/types/referrals";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const ACTIVE = ["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"];

type Action = RespondBody["action"];

export function ReferralDetail({ referralId }: { referralId: string }) {
  const { hasPermission } = useAuth();
  const canMessage = hasPermission(PERMISSIONS.MESSAGES_SEND);
  const { data, loading, error, reload } = useAsync(() => getProviderReferral(referralId), [referralId]);
  const [action, setAction] = useState<Action | null>(null);
  const [placementModal, setPlacementModal] = useState<"schedule" | "unsuccessful" | null>(null);

  const back = (
    <Link href="/provider/referrals" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All referrals
    </Link>
  );

  if (loading) return <LoadingState label="Loading referral…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const canRespond = ACTIVE.includes(data.status);
  const s = data.service;
  const placement = data.placement;

  return (
    <div className="space-y-6">
      <PageHeading
        title={data.reference}
        description={`${humanizeEnum(s.category)} · from ${data.facility.name}`}
        breadcrumb={back}
        actions={<StatusBadge label={referralStatusLabel(data.status)} tone={referralStatusTone(data.status)} />}
      />

      {canRespond ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAction("ACCEPT")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Accept</button>
          <button type="button" onClick={() => setAction("CONDITIONALLY_ACCEPT")} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">Conditionally accept</button>
          <button type="button" onClick={() => setAction("REQUEST_INFORMATION")} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Request information</button>
          <button type="button" onClick={() => setAction("DECLINE")} className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">Decline</button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Service requested">
          <DescriptionList
            items={[
              { label: "Service", value: humanizeEnum(s.category) },
              { label: "Level of care", value: s.levelOfCare ? humanizeEnum(s.levelOfCare) : "—" },
              { label: "Requested start", value: formatDate(s.requestedStartDate) },
              { label: "Frequency", value: s.frequency ?? "—" },
              { label: "Duration", value: s.durationText ?? "—" },
              { label: "Location", value: [s.serviceCity, s.serviceState, s.servicePostalCode].filter(Boolean).join(", ") || "—" },
              { label: "Radius (mi)", value: s.serviceRadiusMiles !== null ? String(s.serviceRadiusMiles) : "—" },
              { label: "Transportation", value: s.transportationRequired ? "Required" : "—" },
            ]}
          />
        </Panel>

        <Panel title="Requirements & funding">
          <DescriptionList
            items={[
              { label: "Funding source", value: s.fundingSource ?? "—" },
              { label: "Insurance plan", value: s.insurancePlan ?? "—" },
              { label: "Required qualifications", value: s.requiredQualifications ?? "—" },
              { label: "Language requirement", value: s.mandatoryLanguage ?? "—" },
              { label: "Equipment needs", value: s.equipmentNeeds ?? "—" },
              { label: "Notes", value: s.notes ?? "—" },
            ]}
          />
        </Panel>

        <Panel title="Patient & discharge">
          <DescriptionList
            items={[
              { label: "Patient", value: data.patientName || "—" },
              { label: "Expected discharge", value: formatDate(data.expectedDischargeDate) },
              { label: "Current setting", value: data.currentCareSetting ? humanizeEnum(data.currentCareSetting) : "—" },
              { label: "Destination", value: data.preferredServiceLocation ?? "—" },
              { label: "Primary language", value: data.primaryLanguage ?? "—" },
              { label: "Interpreter", value: data.interpreterRequired ? "Required" : "—" },
              { label: "Accessibility", value: data.accessibilityNeeds.join(", ") || "—" },
            ]}
          />
        </Panel>

        <Panel title="Coordination contact">
          <DescriptionList
            items={[
              { label: "Patient phone", value: data.coordinationContact.patientContactPhone ?? "—" },
              { label: "Representative", value: [data.coordinationContact.representativeName, data.coordinationContact.representativeRelationship].filter(Boolean).join(" · ") || "—" },
              { label: "Rep. contact", value: data.coordinationContact.representativeContact ?? "—" },
              { label: "Response due", value: formatDate(data.responseDueAt) },
            ]}
          />
        </Panel>
      </div>

      {placement ? (
        <Panel
          title="Placement"
          actions={<StatusBadge label={placementStatusLabel(placement.status)} tone={placementStatusTone(placement.status)} />}
        >
          <DescriptionList
            items={[
              { label: "Accepted", value: formatDateTime(placement.acceptedAt) },
              { label: "Scheduled start", value: formatDateTime(placement.scheduledStartAt) },
              { label: "Actual start", value: formatDateTime(placement.actualStartAt) },
              ...(placement.status === "UNSUCCESSFUL"
                ? [{ label: "Unsuccessful", value: `${placement.unsuccessfulReason ? humanizeEnum(placement.unsuccessfulReason) : ""}${placement.unsuccessfulNote ? ` · ${placement.unsuccessfulNote}` : ""}` }]
                : []),
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {["ACCEPTED", "COORDINATING", "UNSUCCESSFUL"].includes(placement.status) ? (
              <button type="button" onClick={() => setPlacementModal("schedule")} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Schedule service start</button>
            ) : null}
            {placement.status === "SCHEDULED" ? (
              <>
                <button type="button" onClick={() => void confirmReferralStart(referralId).then(() => reload())} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Confirm service started</button>
                <button type="button" onClick={() => setPlacementModal("unsuccessful")} className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">Report unsuccessful start</button>
              </>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="History">
        {data.responses.length === 0 ? (
          <p className="text-sm text-slate-500">No responses yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.responses.map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-umber">{humanizeEnum(r.type)}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}{r.actor ? ` · ${r.actor}` : ""}</span>
                </div>
                {r.declineReason ? <p className="text-xs text-rose-700">Reason: {humanizeEnum(r.declineReason)}</p> : null}
                {r.conditions ? <p className="text-xs text-slate-600">Conditions: {r.conditions}</p> : null}
                {r.proposedStartDate ? <p className="text-xs text-slate-600">Proposed start: {formatDate(r.proposedStartDate)}</p> : null}
                {r.message ? <p className="mt-0.5 text-slate-600">{r.message}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Messages" description="Follow-up communication with the case/Nonnis team about this referral.">
        <MessageThread
          load={() => listReferralMessages(referralId)}
          send={(body) => sendReferralMessage(referralId, body)}
          canSend={canMessage}
          emptyLabel="No messages yet. Use formal actions above for accept/decline/information requests."
        />
      </Panel>

      {action ? <ResponseModal referralId={referralId} action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); reload(); }} /> : null}
      {placementModal ? <PlacementModal referralId={referralId} mode={placementModal} onClose={() => setPlacementModal(null)} onDone={() => { setPlacementModal(null); reload(); }} /> : null}
    </div>
  );
}

const TITLES: Record<Action, string> = {
  ACCEPT: "Accept referral",
  CONDITIONALLY_ACCEPT: "Conditionally accept",
  REQUEST_INFORMATION: "Request information",
  DECLINE: "Decline referral",
};

function ResponseModal({ referralId, action, onClose, onDone }: { referralId: string; action: Action; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<RespondBody>({ action });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<RespondBody>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await respondReferral(referralId, form);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit response.");
      setBusy(false);
    }
  };

  return (
    <Modal title={TITLES[action]} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-3">
        {action === "REQUEST_INFORMATION" ? (
          <Field label="What information do you need?">
            <textarea rows={3} value={form.question ?? ""} onChange={(e) => set({ question: e.target.value })} className={inputCls} />
          </Field>
        ) : null}

        {action === "CONDITIONALLY_ACCEPT" ? (
          <>
            <Field label="Condition(s)">
              <textarea rows={2} value={form.conditions ?? ""} onChange={(e) => set({ conditions: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Proposed start date">
              <input type="date" value={form.proposedStartDate ?? ""} onChange={(e) => set({ proposedStartDate: e.target.value })} className={inputCls} />
            </Field>
            <Confirmations form={form} set={set} />
          </>
        ) : null}

        {action === "ACCEPT" ? (
          <>
            <Field label="Proposed start date (optional)">
              <input type="date" value={form.proposedStartDate ?? ""} onChange={(e) => set({ proposedStartDate: e.target.value })} className={inputCls} />
            </Field>
            <Confirmations form={form} set={set} />
          </>
        ) : null}

        {action === "DECLINE" ? (
          <>
            <Field label="Reason">
              <select value={form.declineReason ?? ""} onChange={(e) => set({ declineReason: e.target.value })} className={`${inputCls} bg-white`}>
                <option value="">Select a reason…</option>
                {DECLINE_REASONS.map((r) => (<option key={r} value={r}>{humanizeEnum(r)}</option>))}
              </select>
            </Field>
            {form.declineReason === "OTHER" ? (
              <Field label="Please explain">
                <textarea rows={2} value={form.declineNote ?? ""} onChange={(e) => set({ declineNote: e.target.value })} className={inputCls} />
              </Field>
            ) : null}
          </>
        ) : null}

        {action !== "REQUEST_INFORMATION" && action !== "DECLINE" ? null : null}
        <Field label="Message (optional)">
          <textarea rows={2} value={form.message ?? ""} onChange={(e) => set({ message: e.target.value })} className={inputCls} />
        </Field>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Confirmations({ form, set }: { form: RespondBody; set: (p: Partial<RespondBody>) => void }) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.fundingConfirmed ?? false} onChange={(e) => set({ fundingConfirmed: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Funding confirmed
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.capacityConfirmed ?? false} onChange={(e) => set({ capacityConfirmed: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Capacity confirmed
      </label>
    </div>
  );
}

function PlacementModal({ referralId, mode, onClose, onDone }: { referralId: string; mode: "schedule" | "unsuccessful"; onClose: () => void; onDone: () => void }) {
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "schedule") await scheduleProviderPlacement(referralId, new Date(scheduledStartAt).toISOString());
      else await reportUnsuccessfulStart(referralId, { reason, note: note || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === "schedule" ? "Schedule service start" : "Report unsuccessful start"} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-3">
        {mode === "schedule" ? (
          <Field label="Scheduled start date/time">
            <input type="datetime-local" value={scheduledStartAt} onChange={(e) => setScheduledStartAt(e.target.value)} className={inputCls} />
          </Field>
        ) : (
          <>
            <Field label="Reason">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select a reason…</option>
                {SERVICE_START_FAILURE_REASONS.map((r) => (<option key={r} value={r}>{humanizeEnum(r)}</option>))}
              </select>
            </Field>
            {reason === "OTHER" ? (
              <Field label="Note"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
            ) : null}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || (mode === "schedule" ? !scheduledStartAt : !reason)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
