"use client";

import { useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { assignableRoles, inviteUser } from "@/services/admin.service";
import { listProviderUsers } from "@/services/providers.service";
import type { ProviderDetailView } from "@/types/providers";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PortalContent } from "./portal-context";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function PortalTeam() {
  return (
    <div className="space-y-6">
      <PageHeading title="Team" description="People in your provider organization." />
      <PortalContent>{(provider) => <TeamBody provider={provider} />}</PortalContent>
    </div>
  );
}

function TeamBody({ provider }: { provider: ProviderDetailView }) {
  const { hasPermission } = useAuth();
  const canInvite = hasPermission(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION);
  const members = useAsync(() => listProviderUsers(provider.id), [provider.id]);
  const [inviting, setInviting] = useState(false);

  return (
    <div className="space-y-6">
      {canInvite ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setInviting((v) => !v)}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            {inviting ? "Cancel" : "Invite teammate"}
          </button>
        </div>
      ) : null}

      {inviting && canInvite ? (
        <InviteForm
          organizationId={provider.organizationId}
          onDone={() => {
            setInviting(false);
            members.reload();
          }}
        />
      ) : null}

      <Panel title="Members">
        {members.loading ? (
          <LoadingState label="Loading team…" />
        ) : members.error ? (
          <ErrorState message={members.error.message} onRetry={members.reload} />
        ) : !members.data || members.data.length === 0 ? (
          <EmptyState title="No members" message="No users belong to your organization yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.data.map((m) => (
              <li key={m.membershipId} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-800">{m.name ?? m.email}</p>
                  <p className="text-xs text-slate-500">{m.email} · {m.roleName}</p>
                </div>
                <StatusBadge label={humanizeEnum(m.membershipStatus)} tone={statusTone(m.membershipStatus)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function InviteForm({ organizationId, onDone }: { organizationId: string; onDone: () => void }) {
  const roles = useAsync(() => assignableRoles(), []);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inviteUser({
        email: form.email,
        organizationId,
        roleCode: form.roleCode,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invitation.");
      setBusy(false);
    }
  };

  return (
    <Panel title="Invite a teammate">
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Email</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
        </label>
        <label className="block"><span className="text-xs font-medium text-slate-600">First name</span><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></label>
        <label className="block"><span className="text-xs font-medium text-slate-600">Last name</span><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Role</span>
          <select required value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} className={`${inputCls} bg-white`}>
            <option value="">Select a role…</option>
            {(roles.data ?? []).map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-400">You can only assign provider roles within your own organization.</span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy || !form.roleCode} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
