"use client";

import { Tags, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MutationButton } from "@/components/ui/MutationButton";
import { EmptyState } from "@/components/ui/states";
import { deleteTag } from "@/services/communications.service";
import type { TagView } from "@/types/communications";

/**
 * Tag housekeeping. Tags are created implicitly by typing a new name on a
 * contact, so without this there is no way to remove one that was created by a
 * typo — it stays in the filter list forever. Deleting a tag removes it from
 * every contact it was applied to; the contacts themselves are never touched.
 */
export function TagManager({ tags, onClose, onChanged }: { tags: TagView[]; onClose: () => void; onChanged: () => void }) {
  return (
    <Modal title="Manage tags" onClose={onClose}>
      {tags.length === 0 ? (
        <EmptyState title="No tags yet" message="Tags are created when you add one to a contact." />
      ) : (
        <ul className="divide-y divide-sage">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Tags className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="truncate text-sm text-slate-800">{tag.name}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {tag.contactCount === 0 ? "unused" : `${tag.contactCount} contact${tag.contactCount === 1 ? "" : "s"}`}
                </span>
              </span>
              <MutationButton
                variant="danger"
                aria-label={`Delete tag ${tag.name}`}
                action={() => deleteTag(tag.id)}
                confirm={{
                  title: `Delete the "${tag.name}" tag?`,
                  description:
                    tag.contactCount === 0
                      ? "This tag is not applied to any contact."
                      : `It will be removed from ${tag.contactCount} contact${tag.contactCount === 1 ? "" : "s"}. The contacts themselves are not deleted.`,
                  confirmLabel: "Delete tag",
                  variant: "danger",
                }}
                successToast={`Deleted "${tag.name}"`}
                errorToast="Could not delete the tag."
                onSuccess={onChanged}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </MutationButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
