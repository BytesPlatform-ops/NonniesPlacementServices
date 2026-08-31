import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatBlogDate } from "@/lib/blog/format";
import type { BlogCard as BlogCardData } from "@/lib/platform/content";

/** Editorial blog card matching the site's warm card language. */
export function BlogCard({ post, featured = false }: { post: BlogCardData; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-navy/10 bg-white shadow-soft transition-shadow duration-300 hover:shadow-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
    >
      <div className={`relative w-full overflow-hidden bg-ice ${featured ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
        {post.featuredImageUrl ? (
          <Image
            src={post.featuredImageUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes={featured ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 768px) 100vw, 400px"}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ice to-sand" aria-hidden />
        )}
        {post.category ? (
          <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy backdrop-blur-sm">
            {post.category}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <h3 className={`font-display font-medium leading-snug text-navy ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>
          {post.title}
        </h3>
        {post.excerpt ? <p className="line-clamp-3 text-sm leading-relaxed text-slate-ink">{post.excerpt}</p> : null}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-ink/70">
          <span>{[post.displayAuthor, formatBlogDate(post.publishedAt)].filter(Boolean).join(" · ")}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-coral">
            Read more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
