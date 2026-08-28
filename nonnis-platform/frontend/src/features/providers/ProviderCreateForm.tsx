"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { createProvider } from "@/services/providers.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";

type OrgMode = "new" | "existing";

export function ProviderCreateForm() {
  const router = useRouter();
  const [orgMode, setOrgMode] = useState<OrgMode>("new");
  const [form, setForm] = useState({
    organizationName: "",
    organizationId: "",
    displayName: "",
    description: "",
    phone: "",
    email: "",
    website: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    timezone: "",
    eligibilityNotes: "",
    internalNotes: "",
    licenseNumber: "",
    licenseType: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body: Record<string, unknown> = {
      displayName: form.displayName,
      description: form.description || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      addressLine1: form.addressLine1 || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      postalCode: form.postalCode || undefined,
      timezone: form.timezone || undefined,
      eligibilityNotes: form.eligibilityNotes || undefined,
      internalNotes: form.internalNotes || undefined,
      licenseNumber: form.licenseNumber || undefined,
      licenseType: form.licenseType || undefined,
    };
    if (orgMode === "existing") body.organizationId = form.organizationId;
    else body.organizationName = form.organizationName;

    try {
      const created = await createProvider(body);
      router.replace(`/providers/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the provider.");
      setBusy(false);
    }
  };

  const back = (
    <Link href="/providers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All providers
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeading title="New provider" description="Create a provider profile and its organization." breadcrumb={back} />

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <form onSubmit={submit} className="space-y-6">
        <Panel title="Organization">
          <div className="mb-4 inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
            {(["new", "existing"] as OrgMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOrgMode(m)}
                className={orgMode === m ? "rounded bg-brand-600 px-3 py-1 font-medium text-white" : "px-3 py-1 text-slate-600"}
              >
                {m === "new" ? "New organization" : "Existing organization"}
              </button>
            ))}
          </div>
          {orgMode === "new" ? (
            <Field label="Organization name" required>
              <input required value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} className={inputCls} />
            </Field>
          ) : (
            <Field label="Existing provider organization ID" required description="Paste an existing PROVIDER organization id that has no provider profile yet.">
              <input required value={form.organizationId} onChange={(e) => set("organizationId", e.target.value)} className={inputCls} />
            </Field>
          )}
        </Panel>

        <Panel title="Provider profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" required className="sm:col-span-2">
              <input required value={form.displayName} onChange={(e) => set("displayName", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} />
            </Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
            <Field label="Website" className="sm:col-span-2"><input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} /></Field>
            <Field label="Address" className="sm:col-span-2"><input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={inputCls} /></Field>
            <Field label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls} /></Field>
            <Field label="Postal code"><input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} /></Field>
            <Field label="Timezone" description="e.g. America/Los_Angeles"><input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls} /></Field>
          </div>
        </Panel>

        <Panel title="Eligibility & credentials (optional)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eligibility notes" description="Population served, admission criteria, restrictions." className="sm:col-span-2">
              <textarea value={form.eligibilityNotes} onChange={(e) => set("eligibilityNotes", e.target.value)} rows={2} className={inputCls} />
            </Field>
            <Field label="License number"><input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className={inputCls} /></Field>
            <Field label="License type"><input value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)} className={inputCls} /></Field>
            <Field label="Internal notes" description="Only visible to staff who manage this provider." className="sm:col-span-2">
              <textarea value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} rows={2} className={inputCls} />
            </Field>
          </div>
        </Panel>

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Creating…" : "Create provider"}
          </button>
          <Link href="/providers" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function Field({
  label,
  required,
  description,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
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
