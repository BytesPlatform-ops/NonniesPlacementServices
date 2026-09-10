"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { MutationButton } from "@/components/ui/MutationButton";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import type { StatusTone } from "@/lib/case-status";
import { grantCareSeekerAccess, listCareSeekers, setCareSeekerAccessStatus } from "@/services/care-seekers.service";
import type { CaseDetail } from "@/types/domain";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800";

const ACCESS_TONES: Record<string, StatusTone> = {
  ACTIVE: "positive",
  INVITED: "info",
  REVOKED: "neutral",
};

/**
 * Who may see this case in the family portal.
 *
 * Access is always explicit — adding someone here is the only way they can open
 * the case. A matching email or phone number recorded on the case grants
 * nothing, which is why this list, not the case's contact fields, is the
 * authority.
 */
export function FamilyAccessTab({ caseDetail }: { caseDetail: CaseDetail }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CARE_SEEKERS_MANAGE);
  const state = useAsync(() => listCareSeekers(caseDetail.id), [caseDetail.id]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", relationship: "" });

  if (!canManage) {
    return (
      <Panel>
        <EmptyState title="Not available" message="You do not have permission to manage family access." />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Give a family member access"
        description="They receive an email invitation and sign in with the normal sign-in page."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="family@example.com"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">First name (optional)</span>
            <input
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Last name (optional)</span>
            <input
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Relationship to the care recipient (optional)</span>
            <input
              value={form.relationship}
              onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
              placeholder="e.g. Daughter"
              className={inputCls}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <MutationButton
            variant="primary"
            pendingLabel="Inviting…"
            disabled={form.email.trim().length === 0}
            confirm={{
              title: "Give this person access to the case?",
              description:
                "They will be able to see the care plan, matched providers, documents, appointments and messages for this case.",
              confirmLabel: "Grant access",
            }}
            action={() =>
              grantCareSeekerAccess(caseDetail.id, {
                email: form.email.trim(),
                firstName: form.firstName.trim() || undefined,
                lastName: form.lastName.trim() || undefined,
                relationship: form.relationship.trim() || undefined,
              })
            }
            successToast="Invitation sent"
            onSuccess={() => {
              setForm({ email: "", firstName: "", lastName: "", relationship: "" });
              state.reload();
            }}
          >
            Invite family member
          </MutationButton>
        </div>
      </Panel>

      <Panel title="Family access" description="Everyone explicitly authorized to see this case.">
        {state.loading ? (
          <LoadingState label="Loading family access…" />
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (state.data?.length ?? 0) === 0 ? (
          <EmptyState title="No family access yet" message="Invite a family member above." />
        ) : (
          <ul className="divide-y divide-sage/70">
            {state.data?.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-umber">{a.name ?? a.email}</p>
                  <p className="text-xs text-slate-500">
                    {a.name ? `${a.email} · ` : ""}
                    {a.relationship ?? "Relationship not recorded"}
                    {a.grantedAt ? ` · invited ${formatDateTime(a.grantedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={a.statusLabel} tone={ACCESS_TONES[a.status] ?? "neutral"} />
                  {a.status === "REVOKED" ? (
                    <MutationButton
                      variant="secondary"
                      pendingLabel="Restoring…"
                      action={() => setCareSeekerAccessStatus(caseDetail.id, a.id, { status: "ACTIVE" })}
                      successToast="Access restored"
                      onSuccess={state.reload}
                    >
                      Restore
                    </MutationButton>
                  ) : (
                    <MutationButton
                      variant="danger-link"
                      pendingLabel="Revoking…"
                      confirm={{
                        title: "Revoke this person's access?",
                        description: "They will no longer be able to open this case. The record of the grant is kept.",
                        confirmLabel: "Revoke access",
                        variant: "danger",
                      }}
                      action={() => setCareSeekerAccessStatus(caseDetail.id, a.id, { status: "REVOKED" })}
                      successToast="Access revoked"
                      onSuccess={state.reload}
                    >
                      Revoke
                    </MutationButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
