"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { activeLabel, activeTone } from "@/lib/content-status";
import { MutationButton } from "@/components/ui/MutationButton";
import { useToast } from "@/providers/toast-provider";
import { MediaUpload } from "./MediaUpload";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_ACCEPT } from "@/services/media.service";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createShortVideo,
  deleteShortVideo,
  listShortVideos,
  setShortVideoActive,
  updateShortVideo,
  type VideoFilters,
} from "@/services/content.service";
import type { ShortVideoView } from "@/types/content";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function ShortVideosView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CONTENT_MANAGE);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ShortVideoView | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const filters: VideoFilters = useMemo(() => ({ page, pageSize: 20, q: debounced || undefined }), [page, debounced]);
  const { data, loading, error: loadError, reload } = useAsync(() => listShortVideos(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<ShortVideoView>[] = [
    {
      key: "video",
      header: "Video",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-sage bg-slate-100">
            {row.posterImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.posterImageUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <button type="button" onClick={() => canManage && setEditing(row)} className="text-left font-medium text-brand-800 hover:underline">{row.title}</button>
            {row.caption ? <p className="truncate text-xs text-slate-500">{row.caption}</p> : null}
          </div>
        </div>
      ),
    },
    { key: "source", header: "Source", render: (row) => row.sourceLabel ?? <span className="text-slate-400">—</span> },
    { key: "order", header: "Order", align: "right", render: (row) => row.sortOrder },
    { key: "active", header: "Status", render: (row) => <StatusBadge label={activeLabel(row.active)} tone={activeTone(row.active)} /> },
    { key: "updated", header: "Updated", render: (row) => formatDate(row.updatedAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        canManage ? (
          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
            <button type="button" onClick={() => setEditing(row)} className="text-sm font-medium text-brand-700 hover:underline">Edit</button>
            <MutationButton
              variant="link"
              pendingLabel={row.active ? "Deactivating…" : "Activating…"}
              confirm={
                row.active
                  ? { title: "Deactivate video?", description: "This video will no longer appear on the public website. You can activate it again later.", confirmLabel: "Deactivate", variant: "warning" }
                  : { title: "Activate video?", description: "This video will appear on the public website.", confirmLabel: "Activate" }
              }
              action={() => setShortVideoActive(row.id, !row.active)}
              successToast={row.active ? "Video deactivated" : "Video activated"}
              onSuccess={reload}
            >
              {row.active ? "Deactivate" : "Activate"}
            </MutationButton>
            <MutationButton
              variant="danger-link"
              pendingLabel="Deleting…"
              confirm={{ title: "Delete video?", description: "This permanently removes the video record. Managed media may also be removed from storage. This action cannot be undone.", confirmLabel: "Delete video", variant: "danger" }}
              action={() => deleteShortVideo(row.id)}
              successToast="Video deleted"
              onSuccess={reload}
            >
              Delete
            </MutationButton>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Short Videos"
        description="Curate the short-form videos shown on the public blog."
        actions={canManage ? <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">New video</button> : undefined}
      />

      <Panel>
        <label className="block max-w-sm">
          <span className="text-xs font-medium text-slate-600">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title…" className={inputCls} />
        </label>
      </Panel>

      <Panel title="Videos" description="Ordered by sort order — lower numbers appear first.">
        {loading ? (
          <LoadingState label="Loading videos…" />
        ) : loadError ? (
          <ErrorState message={loadError.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No videos" message="Add a short video to feature on the blog." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} video{data.total === 1 ? "" : "s"}</span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      {creating ? <VideoModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); void reload(); }} /> : null}
      {editing ? <VideoModal video={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void reload(); }} /> : null}
    </div>
  );
}

function VideoModal({ video, onClose, onDone }: { video?: ShortVideoView; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(video?.title ?? "");
  const [caption, setCaption] = useState(video?.caption ?? "");
  const [videoUrl, setVideoUrl] = useState(video?.videoUrl ?? "");
  const [videoStoragePath, setVideoStoragePath] = useState(video?.videoStoragePath ?? "");
  const [posterImageUrl, setPosterImageUrl] = useState(video?.posterImageUrl ?? "");
  const [posterImageStoragePath, setPosterImageStoragePath] = useState(video?.posterImageStoragePath ?? "");
  const [sourceLabel, setSourceLabel] = useState(video?.sourceLabel ?? "");
  const [sortOrder, setSortOrder] = useState(String(video?.sortOrder ?? 0));
  const [active, setActive] = useState(video?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialVideoPath = useRef<string | null>(video?.videoStoragePath ?? null);
  const initialPosterPath = useRef<string | null>(video?.posterImageStoragePath ?? null);
  const toast = useToast();

  const submit = async () => {
    if (!title.trim() || !videoUrl.trim()) {
      setError("Title and video URL are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: title.trim(),
      caption: caption.trim() || undefined,
      videoUrl: videoUrl.trim(),
      videoStoragePath: videoStoragePath || null,
      posterImageUrl: posterImageUrl || null,
      posterImageStoragePath: posterImageStoragePath || null,
      sourceLabel: sourceLabel.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
      active,
    };
    try {
      if (video) await updateShortVideo(video.id, body);
      else await createShortVideo(body);
      toast.success(video ? "Video updated" : "Video added");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the video.");
      setBusy(false);
    }
  };

  return (
    <Modal title={video ? "Edit video" : "New video"} onClose={onClose} size="lg">
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <ModalField label="Title" required className="sm:col-span-2"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></ModalField>
        <div className="sm:col-span-2">
          <MediaUpload
            label="Video *"
            kind="video"
            variant="video"
            accept={VIDEO_ACCEPT}
            maxBytes={MAX_VIDEO_BYTES}
            value={{ url: videoUrl || null, storagePath: videoStoragePath || null }}
            initialStoragePath={initialVideoPath.current}
            onChange={(v) => { setVideoUrl(v.url ?? ""); setVideoStoragePath(v.storagePath ?? ""); }}
          />
        </div>
        <div className="sm:col-span-2">
          <MediaUpload
            label="Poster / thumbnail"
            kind="poster"
            variant="image"
            accept={IMAGE_ACCEPT}
            maxBytes={MAX_IMAGE_BYTES}
            value={{ url: posterImageUrl || null, storagePath: posterImageStoragePath || null }}
            initialStoragePath={initialPosterPath.current}
            onChange={(v) => { setPosterImageUrl(v.url ?? ""); setPosterImageStoragePath(v.storagePath ?? ""); }}
          />
        </div>
        <ModalField label="Caption" className="sm:col-span-2"><input value={caption} onChange={(e) => setCaption(e.target.value)} className={inputCls} /></ModalField>
        <ModalField label="Source label"><input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Nonnis Stories" className={inputCls} /></ModalField>
        <ModalField label="Sort order"><input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} /></ModalField>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
        Active (visible on the public blog)
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy || !title.trim() || !videoUrl.trim()} onClick={() => void submit()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save video"}</button>
      </div>
    </Modal>
  );
}

function ModalField({ label, required, description, className, children }: { label: string; required?: boolean; description?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}{required ? <span className="ml-0.5 text-rose-600">*</span> : null}</span>
      {description ? <span className="mt-0.5 block text-xs text-slate-400">{description}</span> : null}
      {children}
    </label>
  );
}
