import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { Accordion } from "@/components/ui/Accordion";
import type { Faq } from "@/data/faqs";

export function FaqSection({
  id = "faq",
  eyebrow = "FAQ",
  title = "Questions, answered",
  description,
  items,
  tone = "light",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  items: Faq[];
  tone?: "light" | "ice";
}) {
  return (
    <Section id={id} tone={tone}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} align="center" className="mx-auto" />
        <Reveal className="mt-10">
          <Accordion items={items} />
        </Reveal>
      </div>
    </Section>
  );
}
