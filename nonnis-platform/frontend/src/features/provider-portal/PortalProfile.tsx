"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { updateProvider } from "@/services/providers.service";
import type { ProviderDetailView } from "@/types/providers";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { PortalContent, usePortal } from "./portal-context";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function PortalProfile() {
  return (
    <div className="space-y-6">
      <PageHeading title="Provider profile" description="The information Nonnis holds about your organization." />
      <PortalContent>{(provider, reload) => <ProfileBody provider={provider} reload={reload} />}</PortalContent>
    </div>
  );
}

function ProfileBody({ provider, reload }: { provider: ProviderDetailView; reload: () => void }) {
  const { canManageProfile } = usePortal();
  const [editing, setEditing] = useState(false);

  if (editing && canManageProfile) {
    return <ProfileForm provider={provider} onDone={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />;
  }

  const items = [
    { label: "Display name", value: provider.displayName },
    { label: "Organization", value: provider.organization.name },
    { label: "Phone", value: provider.phone ?? "—" },
    { label: "Email", value: provider.email ?? "—" },
    { label: "Website", value: provider.website ?? "—" },
    { label: "Address", value: [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ") || "—" },
    { label: "Timezone", value: provider.timezone ?? "—" },
    { label: "License", value: [provider.licenseType, provider.licenseNumber].filter(Boolean).join(" · ") || "—" },
    { label: "Updated", value: formatDateTime(provider.updatedAt) },
  ];

  return (
    <div className="space-y-6">
      <Panel
        title="Overview"
        actions={
          canManageProfile ? (
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-brand-700 hover:underline">
              Edit profile
            </button>
          ) : undefined
        }
      >
        {provider.description ? <p className="mb-4 text-sm text-slate-600">{provider.description}</p> : null}
        <DescriptionList items={items} />
        {!canManageProfile ? (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            You have read-only access. A provider administrator can edit this profile.
          </p>
        ) : null}
      </Panel>
      {provider.eligibilityNotes ? (
        <Panel title="Eligibility information">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{provider.eligibilityNotes}</p>
        </Panel>
      ) : null}
    </div>
  );
}

function ProfileForm({ provider, onDone, onCancel }: { provider: ProviderDetailView; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    displayName: provider.displayName,
    description: provider.description ?? "",
    phone: provider.phone ?? "",
    email: provider.email ?? "",
    website: provider.website ?? "",
    addressLine1: provider.addressLine1 ?? "",
    city: provider.city ?? "",
    state: provider.state ?? "",
    postalCode: provider.postalCode ?? "",
    timezone: provider.timezone ?? "",
    eligibilityNotes: provider.eligibilityNotes ?? "",
    licenseNumber: provider.licenseNumber ?? "",
    licenseType: provider.licenseType ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProvider(provider.id, {
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
        licenseNumber: form.licenseNumber || undefined,
        licenseType: form.licenseType || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Edit profile"
      actions={<button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>}
    >
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <F label="Display name" className="sm:col-span-2"><input required value={form.displayName} onChange={(e) => set("displayName", e.target.value)} className={inputCls} /></F>
        <F label="Description" className="sm:col-span-2"><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} /></F>
        <F label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></F>
        <F label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></F>
        <F label="Website" className="sm:col-span-2"><input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} /></F>
        <F label="Address" className="sm:col-span-2"><input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={inputCls} /></F>
        <F label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} /></F>
        <F label="State"><input value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls} /></F>
        <F label="Postal code"><input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} /></F>
        <F label="Timezone"><input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls} /></F>
        <F label="Eligibility information" description="Population served, admission criteria, restrictions." className="sm:col-span-2"><textarea value={form.eligibilityNotes} onChange={(e) => set("eligibilityNotes", e.target.value)} rows={2} className={inputCls} /></F>
        <F label="License number"><input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className={inputCls} /></F>
        <F label="License type"><input value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)} className={inputCls} /></F>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function F({ label, description, className, children }: { label: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {description ? <span className="block text-xs text-slate-400">{description}</span> : null}
      {children}
    </label>
  );
}
