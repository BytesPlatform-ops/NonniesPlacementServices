"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { humanizeEnum } from "@/lib/format";
import { statusTone } from "@/lib/admin-status";
import { useAsync } from "@/hooks/use-async";
import { getOrganization, setOrganizationStatus, updateOrganization } from "@/services/admin.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/providers/toast-provider";

export function OrganizationDetailView({ organizationId }: { organizationId: string }) {
  const { data, loading, error, reload } = useAsync(() => getOrganization(organizationId), [organizationId]);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (data) {
      setName(data.name);
      setLegalName(data.legalName ?? "");
    }
  }, [data]);

  const back = (
    <Link href="/admin/organizations" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> Organizations
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading title="Organization" breadcrumb={back} />
        <Panel><LoadingState /></Panel>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeading title="Organization" breadcrumb={back} />
        <Panel><ErrorState message={error?.message ?? "Not found"} onRetry={reload} /></Panel>
      </div>
    );
  }

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updateOrganization(organizationId, { name, legalName: legalName || undefined });
      toast.success("Organization updated");
      await reload();
    } catch {
      toast.error("Could not save the organization.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={data.name}
        breadcrumb={back}
        actions={<StatusBadge label={humanizeEnum(data.status)} tone={statusTone(data.status)} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Details">
            <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Legal name</span>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  Save changes
                </button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Overview">
            <DescriptionList
              items={[
                { label: "Type", value: humanizeEnum(data.type) },
                { label: "Facilities", value: data.facilitiesCount },
                { label: "Members", value: data.membersCount },
              ]}
            />
          </Panel>
          <Panel title="Status">
            <MutationButton
              variant="secondary"
              className="w-full"
              pendingLabel={data.status === "ACTIVE" ? "Deactivating…" : "Activating…"}
              confirm={
                data.status === "ACTIVE"
                  ? { title: "Deactivate this organization?", description: "Members may lose access and it will be excluded from active workflows. You can reactivate it later.", confirmLabel: "Deactivate", variant: "warning" }
                  : { title: "Activate this organization?", description: "The organization will be active again.", confirmLabel: "Activate" }
              }
              action={() => setOrganizationStatus(organizationId, data.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
              successToast={data.status === "ACTIVE" ? "Organization deactivated" : "Organization activated"}
              onSuccess={reload}
            >
              {data.status === "ACTIVE" ? "Deactivate organization" : "Activate organization"}
            </MutationButton>
          </Panel>
        </div>
      </div>
    </div>
  );
}
