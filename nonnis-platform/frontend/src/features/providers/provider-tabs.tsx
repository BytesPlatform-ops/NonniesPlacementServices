"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { capacityLabel, capacityTone } from "@/lib/provider-status";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { ApiError } from "@/lib/api-client";
import { listLanguages, listPaymentTypes, listServiceCategories } from "@/services/catalog.service";
import {
  addProviderLanguage,
  addProviderPaymentType,
  createCoverage,
  createProviderService,
  listProviderUsers,
  removeCoverage,
  removeProviderLanguage,
  removeProviderPaymentType,
  removeProviderService,
  setProviderCapacity,
  setProviderHours,
  updateProviderService,
} from "@/services/providers.service";
import type { ProviderDetailView } from "@/types/providers";
import { CAPACITY_STATUSES, COVERAGE_TYPES, DAYS_OF_WEEK, LEVELS_OF_CARE } from "@/types/providers";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const selectCls = `${inputCls} bg-white`;

interface TabProps {
  provider: ProviderDetailView;
  reload: () => void;
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge label={active ? "Active" : "Inactive"} tone={active ? "positive" : "neutral"} />;
}

// ---- Services ----

export function ServicesTab({ provider, reload }: TabProps) {
  const editable = provider.editable;
  const categories = useAsync(() => listServiceCategories({ activeOnly: true, pageSize: 100 }), []);
  const [form, setForm] = useState({ serviceCategoryId: "", levelOfCare: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existingIds = new Set(provider.services.map((s) => s.serviceCategoryId));
  const options = (categories.data?.items ?? []).filter((c) => !existingIds.has(c.id));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createProviderService(provider.id, {
        serviceCategoryId: form.serviceCategoryId,
        levelOfCare: form.levelOfCare || undefined,
        description: form.description || undefined,
      });
      setForm({ serviceCategoryId: "", levelOfCare: "", description: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add service.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    await updateProviderService(provider.id, id, { active: !active });
    await reload();
  };
  const remove = async (id: string) => {
    await removeProviderService(provider.id, id);
    await reload();
  };

  return (
    <Panel title="Services offered" description="Service categories this provider offers.">
      <ErrorLine message={error} />
      {provider.services.length === 0 ? (
        <EmptyState title="No services" message="No services have been added yet." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {provider.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{s.categoryName}</p>
                <p className="text-xs text-slate-500">
                  {s.levelOfCare ? humanizeEnum(s.levelOfCare) : "Any level"}
                  {s.description ? ` · ${s.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ActiveBadge active={s.active} />
                {editable ? (
                  <>
                    <button type="button" onClick={() => void toggle(s.id, s.active)} className="text-sm text-brand-700 hover:underline">
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => void remove(s.id)} className="text-slate-400 hover:text-rose-600" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <form onSubmit={add} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Service category</span>
            <select required value={form.serviceCategoryId} onChange={(e) => setForm({ ...form, serviceCategoryId: e.target.value })} className={selectCls}>
              <option value="">Select…</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Level of care</span>
            <select value={form.levelOfCare} onChange={(e) => setForm({ ...form, levelOfCare: e.target.value })} className={selectCls}>
              <option value="">Any</option>
              {LEVELS_OF_CARE.map((l) => (
                <option key={l} value={l}>{humanizeEnum(l)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy || !form.serviceCategoryId} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Adding…" : "Add service"}
            </button>
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

// ---- Coverage ----

export function CoverageTab({ provider, reload }: TabProps) {
  const editable = provider.editable;
  const [form, setForm] = useState({ coverageType: "CITY", city: "", county: "", state: "", postalCode: "", radiusMiles: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createCoverage(provider.id, {
        coverageType: form.coverageType,
        city: form.city || undefined,
        county: form.county || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        radiusMiles: form.radiusMiles ? Number(form.radiusMiles) : undefined,
        notes: form.notes || undefined,
      });
      setForm({ coverageType: "CITY", city: "", county: "", state: "", postalCode: "", radiusMiles: "", notes: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add coverage area.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    await removeCoverage(provider.id, id);
    await reload();
  };

  return (
    <Panel title="Geographic coverage" description="Areas this provider serves.">
      <ErrorLine message={error} />
      {provider.coverageAreas.length === 0 ? (
        <EmptyState title="No coverage areas" message="No coverage has been defined yet." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {provider.coverageAreas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-800">
                  {[c.city, c.county, c.state, c.postalCode].filter(Boolean).join(", ") || humanizeEnum(c.coverageType)}
                  {c.radiusMiles ? ` · ${c.radiusMiles} mi` : ""}
                </p>
                <p className="text-xs text-slate-500">{humanizeEnum(c.coverageType)}{c.notes ? ` · ${c.notes}` : ""}</p>
              </div>
              {editable ? (
                <button type="button" onClick={() => void remove(c.id)} className="text-slate-400 hover:text-rose-600" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <form onSubmit={add} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select value={form.coverageType} onChange={(e) => setForm({ ...form, coverageType: e.target.value })} className={selectCls}>
              {COVERAGE_TYPES.map((t) => (
                <option key={t} value={t}>{humanizeEnum(t)}</option>
              ))}
            </select>
          </label>
          <label className="block"><span className="text-xs font-medium text-slate-600">City</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">County</span><input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">State</span><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Postal code</span><input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600">Radius (mi)</span><input type="number" min={0} value={form.radiusMiles} onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })} className={inputCls} /></label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Adding…" : "Add coverage area"}
            </button>
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

// ---- Payment / insurance ----

export function PaymentTab({ provider, reload }: TabProps) {
  const editable = provider.editable;
  const payments = useAsync(() => listPaymentTypes({ activeOnly: true, pageSize: 100 }), []);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = new Set(provider.paymentTypes.map((p) => p.paymentTypeId));
  const options = (payments.data?.items ?? []).filter((p) => !existing.has(p.id));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await addProviderPaymentType(provider.id, { paymentTypeId, notes: notes || undefined });
      setPaymentTypeId("");
      setNotes("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add payment type.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    await removeProviderPaymentType(provider.id, id);
    await reload();
  };

  return (
    <Panel title="Accepted payment & insurance" description="Payment types this provider accepts.">
      <ErrorLine message={error} />
      {provider.paymentTypes.length === 0 ? (
        <EmptyState title="No payment types" message="No payment or insurance types added yet." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {provider.paymentTypes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-800">{p.name}</p>
                {p.notes ? <p className="text-xs text-slate-500">{p.notes}</p> : null}
              </div>
              {editable ? (
                <button type="button" onClick={() => void remove(p.id)} className="text-slate-400 hover:text-rose-600" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <form onSubmit={add} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Payment type</span>
            <select required value={paymentTypeId} onChange={(e) => setPaymentTypeId(e.target.value)} className={selectCls}>
              <option value="">Select…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy || !paymentTypeId} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Adding…" : "Add payment type"}
            </button>
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

// ---- Languages ----

export function LanguagesTab({ provider, reload }: TabProps) {
  const editable = provider.editable;
  const languages = useAsync(() => listLanguages({ activeOnly: true, pageSize: 100 }), []);
  const [languageId, setLanguageId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = new Set(provider.languages.map((l) => l.languageId));
  const options = (languages.data?.items ?? []).filter((l) => !existing.has(l.id));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await addProviderLanguage(provider.id, { languageId });
      setLanguageId("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add language.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    await removeProviderLanguage(provider.id, id);
    await reload();
  };

  return (
    <Panel title="Languages" description="Languages this provider supports.">
      <ErrorLine message={error} />
      {provider.languages.length === 0 ? (
        <EmptyState title="No languages" message="No languages added yet." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {provider.languages.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-2 rounded-full border border-sage bg-cream px-3 py-1 text-sm text-umber">
              {l.name}
              {editable ? (
                <button type="button" onClick={() => void remove(l.id)} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${l.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Add language</span>
            <select required value={languageId} onChange={(e) => setLanguageId(e.target.value)} className={selectCls}>
              <option value="">Select…</option>
              {options.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !languageId} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}
    </Panel>
  );
}

// ---- Hours ----

interface HourRow {
  dayOfWeek: string;
  closed: boolean;
  open24: boolean;
  opensAt: string;
  closesAt: string;
}

export function HoursTab({ provider, reload }: TabProps) {
  const editable = provider.editable;
  const initial: HourRow[] = DAYS_OF_WEEK.map((day) => {
    const found = provider.hours.find((h) => h.dayOfWeek === day);
    return {
      dayOfWeek: day,
      closed: found?.closed ?? false,
      open24: found?.open24 ?? false,
      opensAt: found?.opensAt ?? "",
      closesAt: found?.closesAt ?? "",
    };
  });
  const [rows, setRows] = useState<HourRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<HourRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await setProviderHours(
        provider.id,
        rows.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          closed: r.closed,
          open24: r.open24,
          opensAt: r.closed || r.open24 ? undefined : r.opensAt || undefined,
          closesAt: r.closed || r.open24 ? undefined : r.closesAt || undefined,
        })),
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save hours.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Operating hours" description="Weekly operating hours.">
      <ErrorLine message={error} />
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.dayOfWeek} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2 text-sm">
            <span className="w-24 font-medium text-slate-700">{humanizeEnum(r.dayOfWeek)}</span>
            {editable ? (
              <>
                <label className="flex items-center gap-1.5 text-slate-600">
                  <input type="checkbox" checked={r.closed} onChange={(e) => update(i, { closed: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Closed
                </label>
                <label className="flex items-center gap-1.5 text-slate-600">
                  <input type="checkbox" checked={r.open24} onChange={(e) => update(i, { open24: e.target.checked })} className="h-4 w-4 accent-brand-600" /> 24 hours
                </label>
                {!r.closed && !r.open24 ? (
                  <>
                    <input type="time" value={r.opensAt} onChange={(e) => update(i, { opensAt: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1" />
                    <span className="text-slate-400">–</span>
                    <input type="time" value={r.closesAt} onChange={(e) => update(i, { closesAt: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1" />
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-slate-600">
                {r.closed ? "Closed" : r.open24 ? "Open 24 hours" : r.opensAt && r.closesAt ? `${r.opensAt} – ${r.closesAt}` : "—"}
              </span>
            )}
          </div>
        ))}
      </div>
      {editable ? (
        <button type="button" onClick={() => void save()} disabled={busy} className="mt-4 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Saving…" : "Save hours"}
        </button>
      ) : null}
    </Panel>
  );
}

// ---- Capacity ----

export function CapacityTab({ provider, reload }: TabProps) {
  const canManage = provider.canManageCapacity;
  const categories = useAsync(() => listServiceCategories({ activeOnly: true, pageSize: 100 }), []);
  const [form, setForm] = useState({ scope: "", status: "AVAILABLE", availableCount: "", effectiveDate: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await setProviderCapacity(provider.id, {
        serviceCategoryId: form.scope || null,
        status: form.status,
        availableCount: form.availableCount ? Number(form.availableCount) : undefined,
        effectiveDate: form.effectiveDate || undefined,
        notes: form.notes || undefined,
      });
      setForm({ scope: "", status: "AVAILABLE", availableCount: "", effectiveDate: "", notes: "" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update capacity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Capacity & availability" description="Current availability, optionally per service category.">
      <ErrorLine message={error} />
      {provider.capacity.length === 0 ? (
        <EmptyState title="No capacity set" message="Availability has not been reported yet." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {provider.capacity.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={capacityLabel(c.status)} tone={capacityTone(c.status)} />
                  <span className="text-sm font-medium text-slate-800">{c.categoryName ?? "Overall"}</span>
                  {c.availableCount !== null ? <span className="text-sm text-slate-500">· {c.availableCount} open</span> : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.effectiveDate ? `Effective ${formatDate(c.effectiveDate)} · ` : ""}
                  Updated {formatDateTime(c.updatedAt)}
                  {c.updatedByName ? ` by ${c.updatedByName}` : ""}
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Scope</span>
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className={selectCls}>
              <option value="">Overall</option>
              {(categories.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Availability</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectCls}>
              {CAPACITY_STATUSES.map((s) => (
                <option key={s} value={s}>{capacityLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Open count</span>
            <input type="number" min={0} value={form.availableCount} onChange={(e) => setForm({ ...form, availableCount: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Effective date</span>
            <input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Saving…" : "Update availability"}
            </button>
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

// ---- Users ----

export function UsersTab({ provider }: { provider: ProviderDetailView }) {
  const { data, loading, error } = useAsync(() => listProviderUsers(provider.id), [provider.id]);

  return (
    <Panel title="Provider users" description="Users with membership in this provider's organization.">
      {loading ? (
        <LoadingState label="Loading users…" />
      ) : error ? (
        <EmptyState title="Unavailable" message={error.message} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No users" message="No users belong to this provider organization yet." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((u) => (
            <li key={u.membershipId} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-800">{u.name ?? u.email}</p>
                <p className="text-xs text-slate-500">{u.email} · {u.roleName}</p>
              </div>
              <StatusBadge label={humanizeEnum(u.membershipStatus)} tone={statusTone(u.membershipStatus)} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Provider users are managed in <Link href="/admin/users" className="text-brand-700 hover:underline">User administration</Link>.
      </p>
    </Panel>
  );
}
