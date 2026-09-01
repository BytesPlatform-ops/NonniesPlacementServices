"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { Modal } from "@/components/ui/Modal";
import { createContact, updateContact } from "@/services/communications.service";
import type { ContactView } from "@/types/communications";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const COUNTRIES = [
  { code: "US", label: "United States (+1)" },
  { code: "CA", label: "Canada (+1)" },
  { code: "GB", label: "United Kingdom (+44)" },
  { code: "AU", label: "Australia (+61)" },
  { code: "MX", label: "Mexico (+52)" },
];

export function ContactForm({ contact, onClose, onSaved }: { contact?: ContactView | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editing = !!contact;
  const [form, setForm] = useState({
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    organizationName: contact?.organizationName ?? "",
    defaultCountry: "US",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Provide at least an email or phone.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      email: form.email.trim() || (editing ? "" : undefined),
      phone: form.phone.trim() || (editing ? "" : undefined),
      organizationName: form.organizationName.trim() || (editing ? "" : undefined),
      defaultCountry: form.defaultCountry,
    };
    try {
      if (editing) await updateContact(contact!.id, body);
      else await createContact(body);
      toast.success(editing ? "Contact updated" : "Contact created");
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the contact.");
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit contact" : "New contact"} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">First name</span>
          <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Last name</span>
          <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Email</span>
          <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" className={inputCls} />
          <span className="mt-1 block text-xs text-slate-400">Format validation only — not mailbox verification.</span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Phone</span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Default country (phone)</span>
          <select value={form.defaultCountry} onChange={(e) => set("defaultCountry", e.target.value)} className={`${inputCls} bg-white`}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Organization</span>
          <input value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} className={inputCls} />
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">At least an email or phone is required. Imported/created contacts start with Unknown consent.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save contact" : "Create contact"}
        </button>
      </div>
    </Modal>
  );
}
