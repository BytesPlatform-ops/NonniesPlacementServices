"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useConfirm, type ConfirmOptions } from "@/providers/confirm-provider";
import { useToast } from "@/providers/toast-provider";
import { blogStatusLabel, blogStatusTone } from "@/lib/content-status";
import { archiveBlogPost, createBlogPost, getBlogPost, publishBlogPost, unpublishBlogPost, updateBlogPost } from "@/services/content.service";
import type { BlogPostDetail } from "@/types/content";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/states";
import { MarkdownEditor } from "./MarkdownEditor";
import { MediaUpload } from "./MediaUpload";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES } from "@/services/media.service";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  displayAuthor: string;
  featuredImageUrl: string;
  featuredImageStoragePath: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
}

const EMPTY: FormState = { title: "", slug: "", excerpt: "", category: "", displayAuthor: "", featuredImageUrl: "", featuredImageStoragePath: "", body: "", metaTitle: "", metaDescription: "" };

function fromDetail(d: BlogPostDetail): FormState {
  return {
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt ?? "",
    category: d.category ?? "",
    displayAuthor: d.displayAuthor ?? "",
    featuredImageUrl: d.featuredImageUrl ?? "",
    featuredImageStoragePath: d.featuredImageStoragePath ?? "",
    body: d.body,
    metaTitle: d.metaTitle ?? "",
    metaDescription: d.metaDescription ?? "",
  };
}

export function BlogEditorForm({ postId }: { postId?: string }) {
  const router = useRouter();
  const editing = Boolean(postId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<BlogPostDetail["status"]>("DRAFT");
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialFeaturedPath = useRef<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (!postId) return;
    let active = true;
    getBlogPost(postId)
      .then((d) => {
        if (!active) return;
        setForm(fromDetail(d));
        setStatus(d.status);
        initialFeaturedPath.current = d.featuredImageStoragePath;
      })
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Could not load the post."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [postId]);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const body = () => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || undefined,
    category: form.category.trim() || undefined,
    displayAuthor: form.displayAuthor.trim() || undefined,
    // Send null (not undefined) so clearing an image persists and triggers cleanup.
    featuredImageUrl: form.featuredImageUrl || null,
    featuredImageStoragePath: form.featuredImageStoragePath || null,
    body: form.body,
    metaTitle: form.metaTitle.trim() || undefined,
    metaDescription: form.metaDescription.trim() || undefined,
  });

  const save = async (publish: boolean) => {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required.");
      return;
    }
    if (publish) {
      const ok = await confirm({ title: "Publish this post?", description: "The post will immediately appear on the public website.", confirmLabel: "Publish" });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing && postId) {
        await updateBlogPost(postId, body());
        if (publish) await publishBlogPost(postId);
        const fresh = await getBlogPost(postId);
        setForm(fromDetail(fresh));
        setStatus(fresh.status);
        initialFeaturedPath.current = fresh.featuredImageStoragePath;
        toast.success(publish ? "Post published" : "Changes saved");
      } else {
        const created = await createBlogPost({ ...body(), ...(publish ? { status: "PUBLISHED" } : {}) });
        toast.success(publish ? "Post published" : "Draft saved");
        router.replace(`/content/blog/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the post.");
    } finally {
      setBusy(false);
    }
  };

  const statusAction = async (fn: () => Promise<BlogPostDetail>, opts: { confirm: ConfirmOptions; success: string }) => {
    if (!postId) return;
    const ok = await confirm(opts.confirm);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      setStatus(updated.status);
      toast.success(opts.success);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link href="/content/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ChevronLeft className="h-4 w-4" aria-hidden /> All posts
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading title="Blog post" breadcrumb={back} />
        <Panel><LoadingState label="Loading post…" /></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title={editing ? "Edit post" : "New post"}
        description={editing ? `/${form.slug}` : "Draft a new article for the public blog."}
        breadcrumb={back}
        actions={editing ? <StatusBadge label={blogStatusLabel(status)} tone={blogStatusTone(status)} /> : undefined}
      />

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void save(false); }}>
        <Panel title="Article">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2">
              <input value={form.title} onChange={(e) => set("title", e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Slug" description="Leave blank to auto-generate from the title. Published URLs stay stable.">
              <input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto-generated" className={inputCls} />
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Care Planning" className={inputCls} />
            </Field>
            <Field label="Author (display)">
              <input value={form.displayAuthor} onChange={(e) => set("displayAuthor", e.target.value)} placeholder="Nonnis Care Team" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <MediaUpload
                label="Featured image"
                kind="blog-featured"
                variant="image"
                accept={IMAGE_ACCEPT}
                maxBytes={MAX_IMAGE_BYTES}
                value={{ url: form.featuredImageUrl || null, storagePath: form.featuredImageStoragePath || null }}
                initialStoragePath={initialFeaturedPath.current}
                onChange={(v) => setForm((f) => ({ ...f, featuredImageUrl: v.url ?? "", featuredImageStoragePath: v.storagePath ?? "" }))}
              />
            </div>
            <Field label="Excerpt" description="Short summary shown on cards and search results." className="sm:col-span-2">
              <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} className={inputCls} />
            </Field>
            <Field label="Body" required description="Rich Markdown editor — headings, lists, links, quotes. No raw HTML." className="sm:col-span-2">
              <MarkdownEditor value={form.body} onChange={(v) => set("body", v)} />
            </Field>
          </div>
        </Panel>

        <Panel title="SEO" description="Optional overrides for search engines and social sharing.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta title">
              <input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Meta description">
              <input value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Save changes" : "Save draft"}
          </button>
          {status !== "PUBLISHED" ? (
            <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {editing ? "Save & publish" : "Publish now"}
            </button>
          ) : null}
          {editing && status === "PUBLISHED" ? (
            <button type="button" disabled={busy} onClick={() => void statusAction(() => unpublishBlogPost(postId!), { confirm: { title: "Unpublish this post?", description: "The post will immediately stop appearing on the public website, but the draft content remains in the CRM.", confirmLabel: "Unpublish", variant: "warning" }, success: "Post unpublished" })} className="rounded-md border border-sage bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-cream disabled:opacity-60">Unpublish</button>
          ) : null}
          {editing && status !== "ARCHIVED" ? (
            <button type="button" disabled={busy} onClick={() => void statusAction(() => archiveBlogPost(postId!), { confirm: { title: "Archive this post?", description: "The post will be removed from the public website. You can restore it by editing and publishing again.", confirmLabel: "Archive", variant: "danger" }, success: "Post archived" })} className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60">Archive</button>
          ) : null}
          <Link href="/content/blog" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, description, className, children }: { label: string; required?: boolean; description?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </span>
      {description ? <span className="mt-0.5 block text-xs text-slate-400">{description}</span> : null}
      {children}
    </label>
  );
}
