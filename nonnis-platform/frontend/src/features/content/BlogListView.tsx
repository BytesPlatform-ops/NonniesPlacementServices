"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { blogStatusLabel, blogStatusTone } from "@/lib/content-status";
import { MutationButton } from "@/components/ui/MutationButton";
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
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          {canManage ? <Link href={`/content/blog/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">Edit</Link> : null}
          {canManage && row.status !== "PUBLISHED" ? (
            <MutationButton
              variant="link"
              className="text-emerald-700 hover:text-emerald-800"
              pendingLabel="Publishing…"
              confirm={{ title: "Publish this post?", description: "The post will immediately appear on the public website.", confirmLabel: "Publish" }}
              action={() => publishBlogPost(row.id)}
              successToast="Post published"
              onSuccess={reload}
            >
              Publish
            </MutationButton>
          ) : null}
          {canManage && row.status === "PUBLISHED" ? (
            <MutationButton
              variant="link"
              pendingLabel="Unpublishing…"
              confirm={{ title: "Unpublish this post?", description: "The post will immediately stop appearing on the public website, but the draft content remains in the CRM.", confirmLabel: "Unpublish", variant: "warning" }}
              action={() => unpublishBlogPost(row.id)}
              successToast="Post unpublished"
              onSuccess={reload}
            >
              Unpublish
            </MutationButton>
          ) : null}
          {canManage && row.status !== "ARCHIVED" ? (
            <MutationButton
              variant="link"
              className="text-amber-700 hover:text-amber-800"
              pendingLabel="Archiving…"
              confirm={{ title: "Archive this post?", description: "The post will be removed from the public website. You can restore it by editing and publishing again.", confirmLabel: "Archive", variant: "danger" }}
              action={() => archiveBlogPost(row.id)}
              successToast="Post archived"
              onSuccess={reload}
            >
              Archive
            </MutationButton>
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
