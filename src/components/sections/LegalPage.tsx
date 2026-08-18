import Link from "next/link";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/animation/Reveal";
import { CONTACT } from "@/lib/constants";

export type LegalSection = { heading: string; body: React.ReactNode };

/**
 * Shared layout for plain-language legal pages (Privacy, Terms). A branded hero
 * plus a readable single-column body and a "questions?" contact card.
 */
export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
  questionPrompt,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  sections: LegalSection[];
  questionPrompt: string;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <Section density="normal">
        <div className="mx-auto max-w-3xl">
          <Reveal stagger={0.06} className="flex flex-col gap-9">
            {sections.map((s) => (
              <div key={s.heading} data-reveal>
                <h2 className="text-lg font-semibold text-navy">{s.heading}</h2>
                <p className="mt-2 leading-relaxed text-slate-ink">{s.body}</p>
              </div>
            ))}
          </Reveal>

          <div className="mt-12 rounded-2xl border border-navy/10 bg-white p-6 shadow-soft sm:p-7">
            <p className="text-slate-ink">
              {questionPrompt} Email{" "}
              <a
                href={`mailto:${CONTACT.email}`}
                className="font-medium text-coral underline underline-offset-2 hover:text-coral/80"
              >
                {CONTACT.email}
              </a>
              .
            </p>
            <Link
              href="/"
              className="mt-4 inline-block font-medium text-coral underline underline-offset-2 hover:text-coral/80"
            >
              Back to home
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
