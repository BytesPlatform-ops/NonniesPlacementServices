"use client";

import { useState } from "react";
import Link from "next/link";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { createOrganization, listOrganizations } from "@/services/admin.service";
import { ORGANIZATION_TYPES, type OrganizationView } from "@/types/admin";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const columns: Column<OrganizationView>[] = [
  {
    key: "name",
    header: "Organization",
    render: (row) => (
      <Link href={`/admin/organizations/${row.id}`} className="font-medium text-brand-700 hover:underline">
        {row.name}
      </Link>
    ),
  },
  { key: "type", header: "Type", render: (row) => humanizeEnum(row.type) },
  { key: "status", header: "Status", render: (row) => <StatusBadge label={humanizeEnum(row.status)} tone={statusTone(row.status)} /> },
  { key: "facilities", header: "Facilities", align: "right", render: (row) => row.facilitiesCount },
  { key: "members", header: "Members", align: "right", render: (row) => row.membersCount },
];

export function OrganizationsAdminView() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(ORGANIZATION_TYPES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(() => listOrganizations({ page: 1 }), []);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createOrganization({ type, name });
      setName("");
      setCreating(false);
      await reload();
    } catch {
      setFormError("Could not create the organization.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Organizations"
        description="Platform administration of the organizations in the Nonnis network."
        actions={
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            {creating ? "Cancel" : "New organization"}
          </button>
        }
      />

      {creating ? (
        <Panel title="New organization">
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {ORGANIZATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanizeEnum(t)}
                  </option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p> : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create organization"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel>
        {loading ? (
          <LoadingState label="Loading organizations…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No organizations" message="Create the first organization to get started." />
        ) : (
          <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} />
        )}
      </Panel>
    </div>
  );
}
