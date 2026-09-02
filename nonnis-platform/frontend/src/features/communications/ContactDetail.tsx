"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { assignTag, getContact, setContactConsent, unassignTag } from "@/services/communications.service";
import { listConversations } from "@/services/communications-inbox.service";
import type { Channel, ConsentStatus, ContactView } from "@/types/communications";
import { channelConsent, contactName } from "./labels";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const CONSENT: ConsentStatus[] = ["UNKNOWN", "OPTED_IN", "OPTED_OUT"];
const SOURCES = ["Website opt-in", "Existing customer consent", "Written consent", "Imported consent record", "Other"];

export function ContactDetail({ contactId }: { contactId: string }) {
  const { data, loading, error, reload } = useAsync(() => getContact(contactId), [contactId]);

  if (loading) return <LoadingState label="Loading contact…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const c = data;

  const back = (
    <Link href="/communications/contacts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All contacts
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeading
        title={contactName(c)}
        description={c.organizationName ?? undefined}
        breadcrumb={back}
        actions={<StatusBadge label={c.status === "ARCHIVED" ? "Archived" : "Active"} tone={c.status === "ARCHIVED" ? "neutral" : "positive"} />}
      />

      <Panel title="Overview">
        <DescriptionList
          items={[
            { label: "Email", value: c.email ?? "—" },
            { label: "Phone", value: c.phone ?? "—" },
            { label: "Organization", value: c.organizationName ?? "—" },
            { label: "Source", value: c.source.replace(/_/g, " ").toLowerCase() },
            { label: "Created", value: formatDateTime(c.createdAt) },
            { label: "Updated", value: formatDateTime(c.updatedAt) },
          ]}
        />
      </Panel>

      <Panel title="Channels & consent" description="Email and SMS consent are tracked separately. Imported contacts start as Unknown.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ConsentCard contactId={c.id} channel="EMAIL" hasChannel={c.hasEmail} consent={c.emailConsent} source={c.emailConsentSource} suppressed={c.emailSuppressed} onSaved={reload} />
          <ConsentCard contactId={c.id} channel="SMS" hasChannel={c.hasPhone} consent={c.smsConsent} source={c.smsConsentSource} suppressed={c.smsSuppressed} onSaved={reload} />
        </div>
      </Panel>

      <Panel title="Lists & tags">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-600">Lists</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {c.lists.length ? c.lists.map((l) => <span key={l.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{l.name}</span>) : <span className="text-sm text-slate-400">Not on any list</span>}
            </div>
          </div>
          <TagEditor contact={c} onChanged={reload} />
        </div>
      </Panel>

      <ContactConversations contactId={c.id} />
    </div>
  );
}

function ConsentCard({ contactId, channel, hasChannel, consent, source, suppressed, onSaved }: { contactId: string; channel: Channel; hasChannel: boolean; consent: ConsentStatus; source: string | null; suppressed: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState<ConsentStatus>(consent);
  const [src, setSrc] = useState(source ?? "");
  const [busy, setBusy] = useState(false);
  const badge = channelConsent(hasChannel, consent, suppressed);

  const save = async () => {
    setBusy(true);
    try {
      await setContactConsent(contactId, channel, value, value === "OPTED_IN" ? src || undefined : undefined);
      toast.success("Consent updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update consent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-sage bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-umber">{channel === "EMAIL" ? "Email" : "SMS"}</p>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>
      {!hasChannel ? (
        <p className="mt-2 text-sm text-slate-500">No {channel === "EMAIL" ? "email" : "phone"} on file.</p>
      ) : (
        <>
          {suppressed ? <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">This address is suppressed and is not sendable.</p> : null}
          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600">Consent</span>
            <select value={value} onChange={(e) => setValue(e.target.value as ConsentStatus)} className={`${inputCls} bg-white`}>
              {CONSENT.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </label>
          {value === "OPTED_IN" ? (
            <label className="mt-2 block">
              <span className="text-xs font-medium text-slate-600">Consent source</span>
              <select value={src} onChange={(e) => setSrc(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select…</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void save()} className="mt-3 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Update consent"}
          </button>
        </>
      )}
    </div>
  );
}

function TagEditor({ contact, onChanged }: { contact: ContactView; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await assignTag(contact.id, name.trim());
      setName("");
      toast.success("Tag added");
      onChanged();
    } catch {
      toast.error("Could not add tag");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (tagId: string) => {
    await unassignTag(contact.id, tagId);
    onChanged();
  };

  return (
    <div>
      <p className="text-xs font-medium text-slate-600">Tags</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {contact.tags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-800">
            {t.name}
            <button type="button" onClick={() => void remove(t.id)} aria-label={`Remove tag ${t.name}`} className="hover:text-rose-600"><X className="h-3 w-3" aria-hidden /></button>
          </span>
        ))}
        {contact.tags.length === 0 ? <span className="text-sm text-slate-400">No tags</span> : null}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a tag" className={`${inputCls} max-w-xs`} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
        <button type="button" disabled={busy || !name.trim()} onClick={() => void add()} className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Add</button>
      </div>
    </div>
  );
}

/**
 * Links to this contact's email + SMS threads. Message content is NOT duplicated
 * here — each row opens the real conversation in the Communications Inbox.
 */
function ContactConversations({ contactId }: { contactId: string }) {
  const { data, loading } = useAsync(() => listConversations({ view: "all", contactId, pageSize: 25 }), [contactId]);
  const items = data?.items ?? [];

  return (
    <Panel title="Communication history" description="Email and SMS threads with this contact.">
      {loading && !data ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No communications yet. Email and SMS threads appear here once a campaign is sent or the contact replies.</p>
      ) : (
        <ul className="divide-y divide-sage/70">
          {items.map((conv) => (
            <li key={conv.id}>
              <Link href={`/communications/inbox?c=${conv.id}`} className="flex items-start gap-2 py-2.5 hover:bg-ivory">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${conv.channel === "SMS" ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"}`}>
                  {conv.channel === "SMS" ? "SMS" : "Email"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-umber">{conv.channel === "SMS" ? (conv.contactPhone ?? "SMS conversation") : (conv.subject ?? "(no subject)")}</span>
                  <span className="block truncate text-xs text-slate-500">{conv.preview ?? ""}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{conv.lastMessageAt ? formatDateTime(conv.lastMessageAt) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
