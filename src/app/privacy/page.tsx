import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/sections/LegalPage";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Nonni's Placement Services collects, uses, and protects the information you share — in plain language.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    body: `We collect the information you provide through our care-request, family, provider-listing and hospital referral forms — such as contact details, professional credentials, care needs and any documents or photos you choose to upload. We only ask for what helps us coordinate care and placement.`,
  },
  {
    heading: "How we use it",
    body: `Your information is used solely to review requests, match families with providers, and coordinate placements. We do not sell your information, and we do not display it publicly.`,
  },
  {
    heading: "How we protect it",
    body: `Submissions are transmitted over an encrypted connection and stored privately with restricted access. Uploaded files are not publicly accessible. Our team receives and reviews submissions through a secure, access-controlled workflow, and we handle sensitive health information in line with HIPAA-aligned practices.`,
  },
  {
    heading: "Sensitive information",
    body: `Please do not send medical details, license numbers or other sensitive information by regular email. Use the secure forms on this site, which are designed to handle that information carefully.`,
  },
  {
    heading: "Your choices",
    body: `You can ask us to update or delete the information you've shared. Contact us and we'll help.`,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy & Data Handling"
      title={
        <>
          Your information,
          <br />
          handled with care.
        </>
      }
      description={`This page explains, in plain language, how ${BRAND.name} handles the information you share. It is a general summary and not a legal contract.`}
      sections={SECTIONS}
      questionPrompt="Questions about privacy?"
    />
  );
}
