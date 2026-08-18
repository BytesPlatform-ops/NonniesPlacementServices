import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/sections/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "A plain-language summary of the terms that apply when you use the Nonni's Placement Services website.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Using this site",
    body: `This website provides information about Nonni's Placement Services' RN-led care placement and lets you submit family, provider and hospital referral requests. By using it you agree to use it lawfully and to provide accurate information.`,
  },
  {
    heading: "No guarantee of placement",
    body: `Submitting a form begins a conversation. It does not guarantee placement, a specific community, an available bed, or a caregiver match. Matches depend on care needs, availability, funding and suitability.`,
  },
  {
    heading: "Not medical advice",
    body: `Content on this site is general information, not medical, legal or professional advice. Always rely on qualified professionals for clinical decisions.`,
  },
  {
    heading: "Your submissions",
    body: (
      <>
        You are responsible for the accuracy of what you submit and for having the right to share any information about
        another person. See our{" "}
        <Link href="/privacy" className="font-medium text-coral underline underline-offset-2 hover:text-coral/80">
          privacy page
        </Link>{" "}
        for how submissions are handled.
      </>
    ),
  },
  {
    heading: "Changes",
    body: `We may update these terms and our services over time. Continued use of the site means you accept the current terms.`,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Use"
      title={
        <>
          The basics, in plain language.
        </>
      }
      description="A general summary of the terms that apply when you use this site. It is not a substitute for a formal agreement."
      sections={SECTIONS}
      questionPrompt="Questions?"
    />
  );
}
