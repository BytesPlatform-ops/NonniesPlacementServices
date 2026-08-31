import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { BlogCard } from "@/components/blog/BlogCard";
import { ShortVideoStrip } from "@/components/blog/ShortVideoStrip";
import { fetchBlogPosts, fetchShortVideos } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Insights & Resources",
  description: "Care planning guidance, family resources, and provider insights from Nonni's Placement Services.",
  openGraph: {
    title: "Insights & Resources · Nonni's Placement Services",
    description: "Care planning guidance, family resources, and provider insights from Nonni's Placement Services.",
    type: "website",
    url: "/blog",
  },
};

// Blog content is fetched from the platform; refresh periodically so newly
// published posts appear without a redeploy.
export const revalidate = 60;

export default async function BlogIndexPage() {
  const [posts, videos] = await Promise.all([fetchBlogPosts(), fetchShortVideos()]);
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="Insights & Resources"
        title="Guidance for every step of the care journey"
        description="Practical articles and short stories on care planning, hospital discharge, and finding the right support — from the Nonni's care team."
      />

      <Section tone="light" density="normal">
        {posts.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-[26px] border border-navy/10 bg-white p-10 text-center shadow-soft">
            <h2 className="font-display text-2xl font-medium text-navy">New articles are on the way</h2>
            <p className="mt-3 text-slate-ink">We&rsquo;re preparing helpful resources for families and partners. Please check back soon.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {featured ? (
              <Reveal>
                <div className="mx-auto max-w-4xl">
                  <BlogCard post={featured} featured />
                </div>
              </Reveal>
            ) : null}

            {rest.length > 0 ? (
              <div>
                <SectionHeading eyebrow="Latest articles" title="More from the blog" />
                <Reveal stagger={0.08} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <div key={post.slug} data-reveal>
                      <BlogCard post={post} />
                    </div>
                  ))}
                </Reveal>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      {videos.length > 0 ? (
        <Section id="short-videos" tone="dark" density="spacious" contained={false} className="overflow-hidden scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
            <SectionHeading
              tone="dark"
              eyebrow="Watch"
              title="Short stories from the Nonni's network"
              description="A closer look at coordinated care — muted previews play as you browse; tap any panel to watch with sound."
            />
          </div>
          {/* True full-bleed media wall: edge-to-edge with only a small breathing gutter. */}
          <div className="mt-10 px-3 sm:mt-14 sm:px-4">
            <ShortVideoStrip videos={videos} />
          </div>
        </Section>
      ) : null}

      <FinalCTA />
    </>
  );
}
