"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { humanizeEnum } from "@/lib/format";
import { CARE_SETTINGS } from "@/lib/case-options";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { createCase } from "@/services/cases.service";
import { listFacilities } from "@/services/admin.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/states";

type PatientMode = "new" | "existing";

export function CaseCreateForm() {
  const router = useRouter();
  const { activeOrganizationId } = useAuth();
  const facilities = useAsync(() => listFacilities({ page: 1 }), [activeOrganizationId]);

  const [patientMode, setPatientMode] = useState<PatientMode>("new");
  const [form, setForm] = useState({
    originatingFacilityId: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    externalRef: "",
    patientContactPhone: "",
    patientId: "",
    expectedDischargeDate: "",
    currentCareSetting: "",
    preferredServiceLocation: "",
    primaryLanguage: "",
    interpreterRequired: false,
    accessibilityNeeds: "",
    representativeName: "",
    representativeRelationship: "",
    representativeContact: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.originatingFacilityId) {
      setError("Select an originating facility.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      originatingFacilityId: form.originatingFacilityId,
      expectedDischargeDate: form.expectedDischargeDate || undefined,
      currentCareSetting: form.currentCareSetting || undefined,
      preferredServiceLocation: form.preferredServiceLocation || undefined,
      primaryLanguage: form.primaryLanguage || undefined,
      interpreterRequired: form.interpreterRequired,
      accessibilityNeeds: form.accessibilityNeeds ? form.accessibilityNeeds.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      patientContactPhone: form.patientContactPhone || undefined,
      representativeName: form.representativeName || undefined,
      representativeRelationship: form.representativeRelationship || undefined,
      representativeContact: form.representativeContact || undefined,
    };
    if (patientMode === "existing") {
      body.patientId = form.patientId;
    } else {
      body.patient = {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || undefined,
        externalRef: form.externalRef || undefined,
      };
    }

    try {
      const created = await createCase(body);
      router.replace(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the case.");
      setBusy(false);
    }
  };

  const back = (
    <Link href="/cases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All cases
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeading title="New discharge case" description="Capture the patient and discharge details. You can complete the assessment next." breadcrumb={back} />

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <form onSubmit={submit} className="space-y-6">
        <Panel title="Originating facility">
          {facilities.loading ? (
            <LoadingState />
          ) : (
            <Field label="Facility" required>
              <select value={form.originatingFacilityId} onChange={(e) => set("originatingFacilityId", e.target.value)} className={selectCls} required>
                <option value="">Select a facility…</option>
                {(facilities.data?.items ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {facilities.data && facilities.data.items.length === 0 ? (
                <p className="mt-1 text-xs text-amber-600">No facilities exist yet. An administrator must add one first.</p>
              ) : null}
            </Field>
          )}
        </Panel>

        <Panel title="Patient">
          <div className="mb-4 inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
            {(["new", "existing"] as PatientMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setPatientMode(m)} className={patientMode === m ? "rounded bg-brand-600 px-3 py-1 font-medium text-white" : "px-3 py-1 text-slate-600"}>
                {m === "new" ? "New patient" : "Existing patient"}
              </button>
            ))}
          </div>
          {patientMode === "new" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required><input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} /></Field>
              <Field label="Last name" required><input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} /></Field>
              <Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputCls} /></Field>
              <Field label="MRN / external reference" description="Helps avoid duplicate patient records."><input value={form.externalRef} onChange={(e) => set("externalRef", e.target.value)} className={inputCls} /></Field>
              <Field label="Contact phone"><input value={form.patientContactPhone} onChange={(e) => set("patientContactPhone", e.target.value)} className={inputCls} /></Field>
            </div>
          ) : (
            <Field label="Existing patient ID" required description="Paste the id of an existing patient in this organization.">
              <input required value={form.patientId} onChange={(e) => set("patientId", e.target.value)} className={inputCls} />
            </Field>
          )}
        </Panel>

        <Panel title="Discharge details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expected discharge date"><input type="date" value={form.expectedDischargeDate} onChange={(e) => set("expectedDischargeDate", e.target.value)} className={inputCls} /></Field>
            <Field label="Current care setting">
              <select value={form.currentCareSetting} onChange={(e) => set("currentCareSetting", e.target.value)} className={selectCls}>
                <option value="">—</option>
                {CARE_SETTINGS.map((s) => (<option key={s} value={s}>{humanizeEnum(s)}</option>))}
              </select>
            </Field>
            <Field label="Destination / preferred service location" className="sm:col-span-2"><input value={form.preferredServiceLocation} onChange={(e) => set("preferredServiceLocation", e.target.value)} className={inputCls} /></Field>
          </div>
        </Panel>

        <Panel title="Communication & accessibility">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary language"><input value={form.primaryLanguage} onChange={(e) => set("primaryLanguage", e.target.value)} className={inputCls} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.interpreterRequired} onChange={(e) => set("interpreterRequired", e.target.checked)} className="h-4 w-4 accent-brand-600" /> Interpreter required
            </label>
            <Field label="Accessibility needs" description="Comma-separated." className="sm:col-span-2"><input value={form.accessibilityNeeds} onChange={(e) => set("accessibilityNeeds", e.target.value)} className={inputCls} /></Field>
          </div>
        </Panel>

        <Panel title="Authorized representative (optional)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name"><input value={form.representativeName} onChange={(e) => set("representativeName", e.target.value)} className={inputCls} /></Field>
            <Field label="Relationship"><input value={form.representativeRelationship} onChange={(e) => set("representativeRelationship", e.target.value)} className={inputCls} /></Field>
            <Field label="Contact"><input value={form.representativeContact} onChange={(e) => set("representativeContact", e.target.value)} className={inputCls} /></Field>
          </div>
        </Panel>

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Creating…" : "Create case"}
          </button>
          <Link href="/cases" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const selectCls = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function Field({ label, required, description, className, children }: { label: string; required?: boolean; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </span>
      {description ? <span className="block text-xs text-slate-400">{description}</span> : null}
      {children}
    </label>
  );
}
