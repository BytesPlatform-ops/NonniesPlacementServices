"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { ApiError } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { duplicateList, getList, listMembers } from "@/services/communications.service";
import { contactName } from "../labels";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Who is actually in an audience, from inside the campaign wizard.
 *
 * Read-only here on purpose. Two ways out, and the difference between them is
 * the point:
 *
 *  - Edit the list itself, which changes it for every campaign that uses it.
 *  - Copy it, which gives this campaign its own editable audience and leaves the
 *    original exactly as other campaigns expect to find it.
 *
 * Copying a consent-driven audience produces an ordinary list: a snapshot of who
 * qualifies right now, which is what "just for this send" means.
 */
export function AudienceListModal({
  listId,
  returnTo,
  onClose,
  onDuplicated,
}: {
  listId: string;
  returnTo: string;
  onClose: () => void;
  /** The new list's id, so the wizard can select it in place of the original. */
  onDuplicated: (newListId: string, name: string) => void;
}) {
  const toast = useToast();
  const list = useAsync(() => getList(listId), [listId]);
  const members = useAsync(() => listMembers(listId, { page: 1, pageSize: 25 }), [listId]);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);

  const copy = async () => {
    setCopying(true);
    try {
      const created = await duplicateList(listId, copyName.trim() || undefined);
      toast.success(`Copied into "${created.name}" — the original is unchanged`);
      onDuplicated(created.id, created.name);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not copy this list.");
    } finally {
      setCopying(false);
    }
  };

  const title = list.data?.name ?? "Audience";

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div className="space-y-4">
        {list.data?.description ? <p className="text-sm text-slate-600">{list.data.description}</p> : null}

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">
            Members{list.data ? ` · ${list.data.memberCount}` : ""}
            {members.data && members.data.total > members.data.items.length ? (
              <span className="ml-1 font-normal text-slate-400">showing the first {members.data.items.length}</span>
            ) : null}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-sage">
            {members.loading && !members.data ? (
              <LoadingState label="Loading members…" />
            ) : members.error ? (
              <ErrorState message={members.error.message} onRetry={members.reload} />
            ) : (members.data?.items ?? []).length === 0 ? (
              <EmptyState title="No members" message="Nobody qualifies for this audience yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {(members.data?.items ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{contactName(c)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{c.phone ?? c.email ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-md border border-sage bg-ivory p-3">
          <p className="text-sm font-medium text-umber">Use a copy for this campaign only</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Creates a new list with these members. Edit it freely — the original stays exactly as it is for every other campaign.
          </p>
          <label className="mt-2 block">
            <span className="text-xs font-medium text-slate-600">New list name</span>
            <input
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder={list.data ? `${list.data.name} (copy)` : "Audience for this campaign"}
              className={inputCls}
            />
          </label>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={copying || !list.data}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {copying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copying ? "Copying…" : "Copy and use for this campaign"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sage pt-3">
          <Link
            href={`/communications/lists?open=${listId}&returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            Edit this list <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
