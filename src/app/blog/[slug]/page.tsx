import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { BlogCard } from "@/components/blog/BlogCard";
import { renderMarkdown } from "@/lib/blog/markdown";
import { formatBlogDate } from "@/lib/blog/format";
import { fetchBlogPost, fetchBlogPosts } from "@/lib/platform/content";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchBlogPost(slug);
  if (!post) {
    return { title: "Article not found", robots: { index: false, follow: false } };
  }
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${title} · Nonni's Placement Services`,
      description,
      type: "article",
      url: `/blog/${post.slug}`,
      ...(post.featuredImageUrl ? { images: [{ url: post.featuredImageUrl }] } : {}),
    },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchBlogPost(slug);
  if (!post) notFound();

  const others = (await fetchBlogPosts({ pageSize: 4 })).filter((p) => p.slug !== post.slug).slice(0, 3);
  const meta = [post.displayAuthor, formatBlogDate(post.publishedAt)].filter(Boolean).join(" · ");

  return (
    <>
      <article>
        <header className="bg-ice pt-32 pb-10 sm:pt-36 sm:pb-12">
          <Container className="max-w-3xl">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-ink transition-colors hover:text-navy">
              <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
            </Link>
            {post.category ? (
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-coral">{post.category}</p>
            ) : null}
            <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.08] tracking-tight text-navy text-balance">
              {post.title}
            </h1>
            {meta ? <p className="mt-4 text-sm text-slate-ink/80">{meta}</p> : null}
          </Container>
        </header>

        {post.featuredImageUrl ? (
          <Container className="max-w-4xl">
            <div className="relative -mt-2 aspect-[16/9] w-full overflow-hidden rounded-[26px] border border-navy/10 bg-ice shadow-card sm:-mt-4">
              <Image src={post.featuredImageUrl} alt={post.title} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 896px" />
            </div>
          </Container>
        ) : null}

        <Container className="max-w-3xl py-12 sm:py-16">
          <div className="blog-body">{renderMarkdown(post.body)}</div>

          <div className="mt-12 border-t border-navy/10 pt-6">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to all articles
            </Link>
          </div>
        </Container>
      </article>

      {others.length > 0 ? (
        <Section tone="ice" density="dense">
          <SectionHeading eyebrow="Keep reading" title="More articles" />
          <Reveal stagger={0.08} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <div key={p.slug} data-reveal>
                <BlogCard post={p} />
              </div>
            ))}
          </Reveal>
        </Section>
      ) : null}

      <FinalCTA />
    </>
  );
}
