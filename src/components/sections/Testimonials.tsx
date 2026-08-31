import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { fetchTestimonials } from "@/lib/platform/content";
import { TestimonialsMarquee } from "@/components/blog/TestimonialsMarquee";

/**
 * Homepage testimonials band. Fetches active testimonials from the platform and
 * renders the flowing marquee. If none are available (or the API is down), the
 * section hides itself — the rest of the page is unaffected.
 */
export async function Testimonials() {
  const testimonials = await fetchTestimonials();
  if (testimonials.length === 0) return null;

  return (
    <Section tone="light" density="normal" contained={false}>
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          align="center"
          eyebrow="Testimonials"
          title="Trusted by families, hospitals, and providers"
          description="Real coordination, real relationships. Here is what the people we work alongside have to say."
        />
      </div>
      <div className="mt-10 sm:mt-14">
        <TestimonialsMarquee testimonials={testimonials} />
      </div>
    </Section>
  );
}
