"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { providerStatusTone } from "@/lib/provider-status";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { getProvider, setProviderStatus, updateProvider } from "@/services/providers.service";
import type { ProviderDetailView } from "@/types/providers";
import { PROVIDER_STATUSES } from "@/types/providers";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CapacityTab, CoverageTab, HoursTab, LanguagesTab, PaymentTab, ServicesTab, UsersTab } from "./provider-tabs";

type TabKey = "overview" | "services" | "coverage" | "payment" | "languages" | "hours" | "capacity" | "users";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "coverage", label: "Coverage" },
  { key: "payment", label: "Payment / Insurance" },
  { key: "languages", label: "Languages" },
  { key: "hours", label: "Hours" },
  { key: "capacity", label: "Capacity" },
  { key: "users", label: "Users" },
];

export function ProviderWorkspace({ providerId }: { providerId: string }) {
  const { data, loading, error, reload } = useAsync(() => getProvider(providerId), [providerId]);
  const [tab, setTab] = useState<TabKey>("overview");

  const back = (
    <Link href="/providers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All providers
    </Link>
  );

  if (loading) return <LoadingState label="Loading provider…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const provider = data;
  const tabs = TABS.filter((t) => t.key !== "users" || provider.editable);

  return (
    <div className="space-y-6">
      <PageHeading
        title={provider.displayName}
        description={provider.organization.name}
        breadcrumb={back}
        actions={<StatusBadge label={humanizeEnum(provider.status)} tone={providerStatusTone(provider.status)} />}
      />

      {provider.editable ? <StatusControl provider={provider} reload={reload} /> : null}

      <div className="border-b border-sage">
        <nav className="-mb-px flex flex-wrap gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "border-brand-600 text-umber" : "border-transparent text-slate-500 hover:text-umber",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" ? <OverviewTab provider={provider} reload={reload} /> : null}
      {tab === "services" ? <ServicesTab provider={provider} reload={reload} /> : null}
      {tab === "coverage" ? <CoverageTab provider={provider} reload={reload} /> : null}
      {tab === "payment" ? <PaymentTab provider={provider} reload={reload} /> : null}
      {tab === "languages" ? <LanguagesTab provider={provider} reload={reload} /> : null}
      {tab === "hours" ? <HoursTab provider={provider} reload={reload} /> : null}
      {tab === "capacity" ? <CapacityTab provider={provider} reload={reload} /> : null}
      {tab === "users" && provider.editable ? <UsersTab provider={provider} /> : null}
    </div>
  );
}

function StatusControl({ provider, reload }: { provider: ProviderDetailView; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const change = async (status: string) => {
    if (status === provider.status) return;
    setBusy(true);
    try {
      await setProviderStatus(provider.id, status);
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Operational status</span>
      <select
        value={provider.status}
        disabled={busy}
        onChange={(e) => void change(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      >
        {PROVIDER_STATUSES.map((s) => (
          <option key={s} value={s}>{humanizeEnum(s)}</option>
        ))}
      </select>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function OverviewTab({ provider, reload }: { provider: ProviderDetailView; reload: () => void }) {
  const [editing, setEditing] = useState(false);
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
    internalNotes: provider.internalNotes ?? "",
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
        internalNotes: form.internalNotes || undefined,
        licenseNumber: form.licenseNumber || undefined,
        licenseType: form.licenseType || undefined,
      });
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Panel title="Edit provider" actions={<button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>}>
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
          <F label="Eligibility notes" className="sm:col-span-2"><textarea value={form.eligibilityNotes} onChange={(e) => set("eligibilityNotes", e.target.value)} rows={2} className={inputCls} /></F>
          <F label="License number"><input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className={inputCls} /></F>
          <F label="License type"><input value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)} className={inputCls} /></F>
          <F label="Internal notes" description="Only visible to staff who manage this provider." className="sm:col-span-2"><textarea value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} rows={2} className={inputCls} /></F>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Panel>
    );
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
        actions={provider.editable ? <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-brand-700 hover:underline">Edit profile</button> : undefined}
      >
        {provider.description ? <p className="mb-4 text-sm text-slate-600">{provider.description}</p> : null}
        <DescriptionList items={items} />
      </Panel>
      {provider.eligibilityNotes ? (
        <Panel title="Eligibility information"><p className="whitespace-pre-wrap text-sm text-slate-700">{provider.eligibilityNotes}</p></Panel>
      ) : null}
      {provider.internalNotes ? (
        <Panel title="Internal notes"><p className="whitespace-pre-wrap text-sm text-slate-700">{provider.internalNotes}</p></Panel>
      ) : null}
    </div>
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
