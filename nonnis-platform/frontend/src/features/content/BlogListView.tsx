"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { blogStatusLabel, blogStatusTone } from "@/lib/content-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { archiveBlogPost, listBlogPosts, publishBlogPost, unpublishBlogPost, type BlogFilters } from "@/services/content.service";
import { CONTENT_STATUSES, type BlogPostSummary } from "@/types/content";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function BlogListView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CONTENT_MANAGE);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status]);

  const filters: BlogFilters = useMemo(
    () => ({ page, pageSize: 20, q: debounced || undefined, status: status || undefined, sort: "updatedAt", order: "desc" }),
    [page, debounced, status],
  );
  const { data, loading, error: loadError, reload } = useAsync(() => listBlogPosts(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<BlogPostSummary>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div className="min-w-0">
          {canManage ? (
            <Link href={`/content/blog/${row.id}`} className="font-medium text-brand-800 hover:underline">{row.title}</Link>
          ) : (
            <span className="font-medium text-umber">{row.title}</span>
          )}
          <p className="truncate text-xs text-slate-500">/{row.slug}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (row) => row.category ?? <span className="text-slate-400">—</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={blogStatusLabel(row.status)} tone={blogStatusTone(row.status)} /> },
    { key: "published", header: "Published", render: (row) => (row.publishedAt ? formatDate(row.publishedAt) : <span className="text-slate-400">—</span>) },
    { key: "updated", header: "Updated", render: (row) => formatDate(row.updatedAt) },
    { key: "author", header: "Author", render: (row) => row.displayAuthor ?? <span className="text-slate-400">—</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {canManage ? <Link href={`/content/blog/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link> : null}
          {canManage && row.status !== "PUBLISHED" ? (
            <button type="button" disabled={busyId === row.id} onClick={() => void act(() => publishBlogPost(row.id), row.id)} className="text-sm text-emerald-700 hover:underline disabled:opacity-50">Publish</button>
          ) : null}
          {canManage && row.status === "PUBLISHED" ? (
            <button type="button" disabled={busyId === row.id} onClick={() => void act(() => unpublishBlogPost(row.id), row.id)} className="text-sm text-slate-500 hover:text-umber disabled:opacity-50">Unpublish</button>
          ) : null}
          {canManage && row.status !== "ARCHIVED" ? (
            <button type="button" disabled={busyId === row.id} onClick={() => void act(() => archiveBlogPost(row.id), row.id)} className="text-sm text-amber-700 hover:underline disabled:opacity-50">Archive</button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Blog"
        description="Write and publish articles for the public website."
        actions={canManage ? <Link href="/content/blog/new" className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">New post</Link> : undefined}
      />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or slug…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{blogStatusLabel(s)}</option>)}
            </select>
          </label>
        </div>
      </Panel>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <Panel title="Posts">
        {loading ? (
          <LoadingState label="Loading posts…" />
        ) : loadError ? (
          <ErrorState message={loadError.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No posts" message="Create your first article to get started." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} post{data.total === 1 ? "" : "s"}</span>
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
    </div>
  );
}
