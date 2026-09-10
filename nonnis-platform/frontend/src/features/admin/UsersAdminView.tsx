"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { activeOrgType } from "@/lib/landing";
import { rolesAssignableIn } from "@/lib/assignable-roles";
import {
  assignableRoles,
  changeMembershipRole,
  deleteUser,
  inviteUser,
  listOrganizations,
  listUsers,
  setUserStatus,
} from "@/services/admin.service";
import type { RoleOption, UserListItem } from "@/types/admin";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useAction } from "@/hooks/use-action";

export function UsersAdminView() {
  const { activeOrganizationId, hasPermission, me } = useAuth();
  const params = useSearchParams();
  const canManage =
    hasPermission(PERMISSIONS.USERS_MANAGE) || hasPermission(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION);
  // A platform user manager acts across organizations — the same rule the
  // server has always applied to the invite endpoint. An organization-scoped
  // manager (a provider admin) stays inside their own, so neither the filter
  // nor the selector is shown to them.
  const isPlatformManager = hasPermission(PERMISSIONS.USERS_MANAGE);

  // Provider detail links here with the provider's organization preselected.
  const [orgFilter, setOrgFilter] = useState(() => (isPlatformManager ? (params.get("organizationId") ?? "") : ""));

  const organizations = useAsync(
    () => (isPlatformManager ? listOrganizations({ page: 1 }) : Promise.resolve(null)),
    [isPlatformManager],
  );
  const users = useAsync(
    () => listUsers({ page: 1, ...(orgFilter ? { organizationId: orgFilter } : {}) }),
    [activeOrganizationId, orgFilter],
  );
  const roles = useAsync<RoleOption[]>(() => (canManage ? assignableRoles() : Promise.resolve([])), [activeOrganizationId, canManage]);

  const orgOptions = useMemo(
    () => (organizations.data?.items ?? []).filter((o) => o.status === "ACTIVE"),
    [organizations.data],
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleCode: "", organizationId: "" });

  // Which organization the invitation is for: the one chosen in the form for a
  // platform manager, otherwise the actor's own active organization.
  const targetOrganizationId = isPlatformManager ? form.organizationId : (activeOrganizationId ?? "");
  // Its type decides which roles are offered. For a platform manager that is
  // the selected organization's own type — reading their active organization's
  // type instead is exactly what made a provider role unofferable here.
  const orgType = isPlatformManager
    ? (orgOptions.find((o) => o.id === targetOrganizationId)?.type ?? null)
    : activeOrgType(me, activeOrganizationId);
  // Offer only the roles that are valid in that organization's type. The server
  // rejects an incompatible pairing with a 400 either way; filtering here means
  // the option is never presented in the first place, and the rules come from
  // the server with each role rather than being restated in the UI.
  const assignable = rolesAssignableIn(roles.data, orgType);
  const assignableCodes = new Set(rolesAssignableIn(roles.data, activeOrgType(me, activeOrganizationId)).map((r) => r.code));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetOrganizationId) return;
    setBusy(true);
    setFormError(null);
    try {
      await inviteUser({
        email: form.email,
        organizationId: targetOrganizationId,
        roleCode: form.roleCode || assignable[0]?.code || "",
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      setForm({ email: "", firstName: "", lastName: "", roleCode: "", organizationId: "" });
      setInviteOpen(false);
      setNotice("Invitation sent.");
      // Show the organization just invited into, so the new user is visible
      // straight away rather than appearing to have vanished.
      if (isPlatformManager) setOrgFilter(targetOrganizationId);
      await users.reload();
    } catch (err) {
      // The server is the authority on organization and role validity, so its
      // message is more useful than a generic one.
      setFormError(err instanceof Error && err.message ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const runAction = useAction();

  const onRoleChange = async (row: UserListItem, roleCode: string) => {
    if (roleCode === row.membership.roleCode) return;
    await runAction({
      confirm: { title: "Change this user's role?", description: `Their access will change to match the new role.`, confirmLabel: "Change role" },
      run: () => changeMembershipRole(row.id, row.membership.membershipId, roleCode),
      success: "Role updated",
    });
    await users.reload(); // reflect the change, or reset the select if cancelled
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
                <div className="flex items-center justify-end gap-3">
                  {row.status === "SUSPENDED" ? (
                    <MutationButton
                      variant="link"
                      className="text-brand-700 hover:text-brand-800"
                      pendingLabel="Reactivating…"
                      confirm={{ title: "Reactivate this user?", description: "The user will regain normal access to their organization.", confirmLabel: "Reactivate" }}
                      action={() => setUserStatus(row.id, "ACTIVE")}
                      successToast="User reactivated"
                      onSuccess={() => users.reload()}
                    >
                      Reactivate
                    </MutationButton>
                  ) : (
                    <MutationButton
                      variant="danger-link"
                      pendingLabel="Suspending…"
                      confirm={{ title: "Suspend this user?", description: "The user will lose normal access until their account is reactivated.", confirmLabel: "Suspend user", variant: "danger" }}
                      action={() => setUserStatus(row.id, "SUSPENDED")}
                      successToast="User suspended"
                      onSuccess={() => users.reload()}
                    >
                      Suspend
                    </MutationButton>
                  )}
                  {/* Deleting frees the email address to be invited again, which
                      suspending does not. An active account is deliberately not
                      offered it — the server refuses one, so suspending is the
                      step that comes first. */}
                  {row.status === "ACTIVE" ? null : (
                    <MutationButton
                      variant="danger-link"
                      pendingLabel="Deleting…"
                      confirm={{
                        title: "Delete this account?",
                        description: `${row.email} and their sign-in are removed for good, and the address becomes free to invite again. Cases, messages and history remain, but stop naming this account.`,
                        confirmLabel: "Delete account",
                        variant: "danger",
                      }}
                      action={() => deleteUser(row.id)}
                      successToast="Account deleted"
                      onSuccess={() => users.reload()}
                    >
                      Delete
                    </MutationButton>
                  )}
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Users"
        description={
          isPlatformManager
            ? "People with access to any organization you manage."
            : "People with access to your active organization."
        }
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
            {isPlatformManager ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Organization</span>
                <select
                  required
                  value={form.organizationId}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value, roleCode: "" })}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="">Select an organization…</option>
                  {orgOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · {humanizeEnum(o.type)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  The roles below are the ones valid in this organization.
                </span>
              </label>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select
                disabled={isPlatformManager && !form.organizationId}
                value={form.roleCode || assignable[0]?.code || ""}
                onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {isPlatformManager && !form.organizationId ? (
                  <option value="">Choose an organization first…</option>
                ) : null}
                {assignable.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
              {isPlatformManager && form.organizationId && assignable.length === 0 ? (
                <span className="mt-1 block text-xs text-amber-700">
                  No role you may assign is valid in this organization type.
                </span>
              ) : null}
            </label>
            {formError ? <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p> : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || assignable.length === 0 || !targetOrganizationId}
                className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel
        title={orgFilter ? (orgOptions.find((o) => o.id === orgFilter)?.name ?? "Users") : "All users"}
        actions={
          isPlatformManager ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Organization</span>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">All organizations</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {humanizeEnum(o.type)}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      >
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
