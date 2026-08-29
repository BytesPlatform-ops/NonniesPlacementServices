"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  blockerSeverityLabel,
  blockerSeverityTone,
  componentStatusIcon,
  componentStatusLabel,
  componentStatusTone,
  criticalBlockerCount,
  formatReadinessPercentage,
  readinessLevelLabel,
  readinessLevelTone,
  readinessLinkTab,
  readinessPhaseLabel,
} from "@/lib/readiness";
import {
  markCompleted,
  markDischarged,
  markReadyForDischarge,
  markServiceStarted,
} from "@/services/readiness.service";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/states";
import type { CaseDetail } from "@/types/domain";
import type { ReadinessBlocker, ReadinessComponent, ReadinessView } from "@/types/readiness";

export function ReadinessTab({
  caseDetail,
  readiness,
  loading,
  canUpdate,
  onChange,
  onNavigate,
}: {
  caseDetail: CaseDetail;
  readiness: ReadinessView | null;
  loading: boolean;
  canUpdate: boolean;
  onChange: () => Promise<void> | void;
  onNavigate: (tab: string) => void;
}) {
  if (loading && !readiness) return <Panel><LoadingState label="Evaluating readiness…" /></Panel>;
  if (!readiness) return <Panel><p className="text-sm text-slate-500">Readiness is unavailable for this case.</p></Panel>;

  const passedGates = readiness.gates.filter((g) => g.passed).length;
  const criticals = criticalBlockerCount(readiness.blockers);

  return (
    <div className="space-y-6">
      {readiness.statusMismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Status is “Ready for Discharge”, but readiness requirements are no longer satisfied.
          </p>
          <p className="mt-1 text-amber-800">Review the blockers below and correct the case before discharging.</p>
        </div>
      ) : null}

      <ReadinessSummary readiness={readiness} passedGates={passedGates} criticals={criticals} />

      <ReadinessActions
        caseDetail={caseDetail}
        readiness={readiness}
        canUpdate={canUpdate}
        onChange={onChange}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Readiness components" description="What is complete, incomplete, or not applicable.">
          <ul className="divide-y divide-sage/70">
            {readiness.components.map((c) => (
              <ComponentRow key={c.code} component={c} onNavigate={onNavigate} />
            ))}
          </ul>
        </Panel>

        <Panel title="Blockers" description="What must be resolved before discharge.">
          {readiness.blockers.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> No outstanding blockers.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {readiness.blockers.map((b) => (
                <BlockerRow key={b.code} blocker={b} onNavigate={onNavigate} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Mandatory gates" description="Every gate must pass for a case to be ready for discharge.">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {readiness.gates.map((g) => (
            <li key={g.code} className="flex items-start gap-2 text-sm">
              <span aria-hidden className={g.passed ? "text-emerald-600" : "text-rose-600"}>{g.passed ? "✓" : "✕"}</span>
              <span>
                <span className="font-medium text-umber">{g.label}</span>
                <span className="sr-only">{g.passed ? " passed" : " not passed"}</span>
                <span className="block text-xs text-slate-500">{g.explanation}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function ReadinessSummary({ readiness, passedGates, criticals }: { readiness: ReadinessView; passedGates: number; criticals: number }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-4">
          <ReadinessDial percentage={readiness.percentage} ready={readiness.ready} level={readiness.level} />
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge label={readinessLevelLabel(readiness.level)} tone={readinessLevelTone(readiness.level)} />
              <span className="text-xs text-slate-500">{readinessPhaseLabel(readiness.phase)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {passedGates} of {readiness.gates.length} mandatory gates passed
            </p>
            <p className="text-sm text-slate-600">
              {criticals === 0 ? "No critical blockers" : `${criticals} critical blocker${criticals === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ReadinessDial({ percentage, ready, level }: { percentage: number; ready: boolean; level: ReadinessView["level"] }) {
  const color = ready ? "#15803d" : level === "BLOCKED" ? "#e11d48" : "#b45309";
  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${percentage * 3.6}deg, #e7e2d6 0deg)` }}
      role="img"
      aria-label={`Readiness ${formatReadinessPercentage(percentage)}, ${ready ? "ready" : "not ready"}`}
    >
      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-ivory">
        <span className="font-display text-lg font-semibold text-umber">{formatReadinessPercentage(percentage)}</span>
      </div>
    </div>
  );
}

function ComponentRow({ component, onNavigate }: { component: ReadinessComponent; onNavigate: (tab: string) => void }) {
  const tab = readinessLinkTab(component.link);
  const dim = component.status === "NOT_APPLICABLE";
  return (
    <li className={`flex items-start justify-between gap-3 py-2.5 ${dim ? "opacity-70" : ""}`}>
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden className={`mt-0.5 text-sm ${toneText(component.status)}`}>{componentStatusIcon(component.status)}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-umber">
            {component.label}
            {component.required ? null : <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
          </p>
          <p className="text-xs text-slate-500">{component.explanation}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge label={componentStatusLabel(component.status)} tone={componentStatusTone(component.status)} />
        {tab && component.status !== "COMPLETE" && component.status !== "NOT_APPLICABLE" ? (
          <button type="button" onClick={() => onNavigate(tab)} className="text-slate-400 hover:text-brand-700" aria-label={`Go to ${tab}`}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function BlockerRow({ blocker, onNavigate }: { blocker: ReadinessBlocker; onNavigate: (tab: string) => void }) {
  const tab = readinessLinkTab(blocker.link);
  return (
    <li className="rounded-md border border-sage bg-porcelain px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-umber">
            <StatusBadge label={blockerSeverityLabel(blocker.severity)} tone={blockerSeverityTone(blocker.severity)} />
            {blocker.label}
          </p>
          <p className="mt-1 text-xs text-slate-600">{blocker.explanation}</p>
        </div>
        {tab ? (
          <button type="button" onClick={() => onNavigate(tab)} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
            {tab}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function toneText(status: ReadinessComponent["status"]): string {
  switch (status) {
    case "COMPLETE":
      return "text-emerald-600";
    case "BLOCKED":
      return "text-rose-600";
    case "INCOMPLETE":
      return "text-amber-600";
    default:
      return "text-slate-400";
  }
}

// ---- Actions ----

function ReadinessActions({
  caseDetail,
  readiness,
  canUpdate,
  onChange,
}: {
  caseDetail: CaseDetail;
  readiness: ReadinessView;
  canUpdate: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  if (!canUpdate) return null;

  const status = caseDetail.status;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setReasons([]);
    try {
      await fn();
      await onChange();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        const details = e.details as { blockers?: Array<{ label: string }>; reasons?: string[] } | undefined;
        setReasons(details?.reasons ?? details?.blockers?.map((b) => b.label) ?? []);
      } else {
        setError("The action could not be completed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const showMarkReady = ["READY_FOR_REVIEW", "MATCHING", "REFERRAL_SENT", "PROVIDER_REVIEWING", "ADDITIONAL_INFORMATION_REQUIRED", "ACCEPTED", "SERVICES_BEING_COORDINATED"].includes(status);
  const showDischarge = status === "READY_FOR_DISCHARGE";
  const showServiceStarted = status === "DISCHARGED";
  const showCompleted = status === "DISCHARGED" || status === "SERVICE_STARTED" || status === "FOLLOW_UP_REQUIRED";

  const criticals = criticalBlockerCount(readiness.blockers);

  return (
    <Panel title="Discharge actions" description="Explicit, manual lifecycle actions. Readiness never changes status on its own.">
      <div className="flex flex-wrap items-center gap-3">
        {showMarkReady ? (
          readiness.ready ? (
            <button type="button" disabled={busy} onClick={() => void run(() => markReadyForDischarge(caseDetail.id))} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              Mark ready for discharge
            </button>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-umber">{criticals} blocker{criticals === 1 ? "" : "s"}</span> must be resolved before this case can be marked ready.
            </p>
          )
        ) : null}

        {showDischarge ? (
          <button type="button" disabled={busy || readiness.statusMismatch} onClick={() => setDischargeOpen(true)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            Mark discharged
          </button>
        ) : null}
        {showDischarge && readiness.statusMismatch ? (
          <span className="text-xs text-amber-700">Resolve the blockers above before discharging.</span>
        ) : null}

        {showServiceStarted ? (
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !readiness.serviceStart.allStarted} onClick={() => void run(() => markServiceStarted(caseDetail.id))} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              Mark service started
            </button>
            <span className="text-xs text-slate-500">
              {readiness.serviceStart.startedPlacements}/{readiness.serviceStart.requiredPlacements} placements started
            </span>
          </div>
        ) : null}

        {showCompleted ? (
          <button type="button" disabled={busy} onClick={() => void run(() => markCompleted(caseDetail.id))} className="rounded-md border border-sage bg-white px-3 py-1.5 text-sm font-medium text-umber hover:bg-cream disabled:opacity-60">
            Mark completed
          </button>
        ) : null}

        {!showMarkReady && !showDischarge && !showServiceStarted && !showCompleted ? (
          <p className="text-sm text-slate-500">No discharge actions are available for this case status.</p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" aria-hidden /> {error}</p>
          {reasons.length > 0 ? (
            <ul className="mt-1.5 list-inside list-disc text-rose-700/90">
              {reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      {dischargeOpen ? (
        <DischargeModal
          busy={busy}
          onClose={() => setDischargeOpen(false)}
          onConfirm={async (date, note) => {
            await run(() => markDischarged(caseDetail.id, date, note));
            setDischargeOpen(false);
          }}
        />
      ) : null}
    </Panel>
  );
}

function DischargeModal({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: (date: string, note?: string) => Promise<void> }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  return (
    <Modal title="Mark discharged" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Record the actual discharge date and time. This is an explicit action and is not inferred from other events.</p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-umber">Actual discharge date/time</span>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-umber">Note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sage bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-cream">Cancel</button>
          <button
            type="button"
            disabled={busy || !date}
            onClick={() => void onConfirm(new Date(date).toISOString(), note.trim() || undefined)}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Confirm discharge
          </button>
        </div>
      </div>
    </Modal>
  );
}
