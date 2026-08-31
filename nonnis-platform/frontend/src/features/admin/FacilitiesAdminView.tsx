"use client";

import { useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { createFacility, listFacilities, setFacilityStatus } from "@/services/admin.service";
import type { FacilityView } from "@/types/admin";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export function FacilitiesAdminView() {
  const { activeOrganizationId, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.FACILITIES_MANAGE);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", state: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => listFacilities({ page: 1 }), [activeOrganizationId]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createFacility({ name: form.name, city: form.city || undefined, state: form.state || undefined, phone: form.phone || undefined });
      setForm({ name: "", city: "", state: "", phone: "" });
      setCreating(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<FacilityView>[] = [
    { key: "name", header: "Facility", render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
    { key: "location", header: "Location", render: (row) => [row.city, row.state].filter(Boolean).join(", ") || "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={humanizeEnum(row.status)} tone={statusTone(row.status)} /> },
    { key: "cases", header: "Cases", align: "right", render: (row) => row.casesCount },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (row: FacilityView) => (
              <MutationButton
                variant="link"
                className={row.status === "ACTIVE" ? "text-amber-700 hover:text-amber-800" : "text-brand-700 hover:text-brand-800"}
                pendingLabel={row.status === "ACTIVE" ? "Deactivating…" : "Activating…"}
                confirm={
                  row.status === "ACTIVE"
                    ? { title: "Deactivate this facility?", description: "It will no longer be available for new cases. You can reactivate it later.", confirmLabel: "Deactivate", variant: "warning" }
                    : { title: "Activate this facility?", description: "It will be available for new cases again.", confirmLabel: "Activate" }
                }
                action={() => setFacilityStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                successToast={row.status === "ACTIVE" ? "Facility deactivated" : "Facility activated"}
                onSuccess={reload}
              >
                {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </MutationButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Facilities"
        description="Facilities belonging to your active organization."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setCreating((c) => !c)}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              {creating ? "Cancel" : "New facility"}
            </button>
          ) : undefined
        }
      />

      {creating ? (
        <Panel title="New facility">
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">City</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">State</span>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create facility"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel>
        {loading ? (
          <LoadingState label="Loading facilities…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No facilities" message="No facilities exist for this organization yet." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} />
        )}
      </Panel>
    </div>
  );
}
