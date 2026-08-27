"use client";

import { useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { assignableRoles, changeMembershipRole, inviteUser, listUsers, setUserStatus } from "@/services/admin.service";
import type { RoleOption, UserListItem } from "@/types/admin";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export function UsersAdminView() {
  const { activeOrganizationId, hasPermission } = useAuth();
  const canManage =
    hasPermission(PERMISSIONS.USERS_MANAGE) || hasPermission(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION);

  const users = useAsync(() => listUsers({ page: 1 }), [activeOrganizationId]);
  const roles = useAsync<RoleOption[]>(() => (canManage ? assignableRoles() : Promise.resolve([])), [activeOrganizationId, canManage]);
  const assignable = roles.data ?? [];
  const assignableCodes = new Set(assignable.map((r) => r.code));

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleCode: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeOrganizationId) return;
    setBusy(true);
    setFormError(null);
    try {
      await inviteUser({
        email: form.email,
        organizationId: activeOrganizationId,
        roleCode: form.roleCode || assignable[0]?.code || "",
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      setForm({ email: "", firstName: "", lastName: "", roleCode: "" });
      setInviteOpen(false);
      setNotice("Invitation sent.");
      await users.reload();
    } catch {
      setFormError("Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const onRoleChange = async (row: UserListItem, roleCode: string) => {
    await changeMembershipRole(row.id, row.membership.membershipId, roleCode);
    await users.reload();
  };

  const onToggleStatus = async (row: UserListItem) => {
    await setUserStatus(row.id, row.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED");
    await users.reload();
  };

  const columns: Column<UserListItem>[] = [
    {
      key: "user",
      header: "User",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.displayName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) =>
        canManage && assignableCodes.has(row.membership.roleCode) ? (
          <select
            value={row.membership.roleCode}
            onChange={(e) => void onRoleChange(row, e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            {assignable.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-600">{row.membership.roleName}</span>
        ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={humanizeEnum(row.status)} tone={statusTone(row.status)} /> },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (row: UserListItem) =>
              assignableCodes.has(row.membership.roleCode) ? (
                <button
                  type="button"
                  onClick={() => void onToggleStatus(row)}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  {row.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                </button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Users"
        description="People with access to your active organization."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                setInviteOpen((o) => !o);
                setNotice(null);
              }}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              {inviteOpen ? "Cancel" : "Invite user"}
            </button>
          ) : undefined
        }
      />

      {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      {inviteOpen ? (
        <Panel title="Invite a user">
          <form onSubmit={onInvite} className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">First name</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select
                value={form.roleCode || assignable[0]?.code || ""}
                onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {assignable.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p> : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || assignable.length === 0}
                className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel>
        {users.loading ? (
          <LoadingState label="Loading users…" />
        ) : users.error ? (
          <ErrorState message={users.error.message} onRetry={users.reload} />
        ) : !users.data || users.data.items.length === 0 ? (
          <EmptyState title="No users" message="Invite the first user to this organization." />
        ) : (
          <DataTable columns={columns} rows={users.data.items} getRowKey={(row) => row.id} />
        )}
      </Panel>
    </div>
  );
}
