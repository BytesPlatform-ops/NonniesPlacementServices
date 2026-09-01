import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, MailX } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { fetchUnsubscribeStatus, submitUnsubscribe } from "@/lib/platform/unsubscribe";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export default async function UnsubscribeEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const token = one(sp.token);
  const done = one(sp.done) === "1";
  const status = token ? await fetchUnsubscribeStatus(token) : { valid: false };

  async function unsubscribe() {
    "use server";
    await submitUnsubscribe(token);
    redirect(`/unsubscribe/email?token=${encodeURIComponent(token)}&done=1`);
  }

  const succeeded = done || status.alreadyUnsubscribed;

  return (
    <Section tone="ice" density="spacious">
      <Container className="max-w-xl">
        <div className="rounded-[26px] border border-navy/10 bg-white p-8 text-center shadow-soft sm:p-10">
          {!status.valid ? (
            <>
              <MailX className="mx-auto h-10 w-10 text-slate-ink/50" aria-hidden />
              <h1 className="mt-4 font-display text-2xl font-medium text-navy">This link is invalid or expired</h1>
              <p className="mt-3 text-slate-ink">We couldn&rsquo;t verify this unsubscribe link. If you continue to receive emails you didn&rsquo;t expect, please contact us.</p>
            </>
          ) : succeeded ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-coral" aria-hidden />
              <h1 className="mt-4 font-display text-2xl font-medium text-navy">You&rsquo;re unsubscribed</h1>
              <p className="mt-3 text-slate-ink">{status.email ? `${status.email} has ` : "You have "}been removed from Nonni&rsquo;s marketing emails. You may still receive essential account messages.</p>
            </>
          ) : (
            <>
              <MailX className="mx-auto h-10 w-10 text-coral" aria-hidden />
              <h1 className="mt-4 font-display text-2xl font-medium text-navy">Unsubscribe from emails</h1>
              <p className="mt-3 text-slate-ink">{status.email ? `Stop sending marketing emails to ${status.email}?` : "Stop sending marketing emails to this address?"}</p>
              <form action={unsubscribe} className="mt-6">
                <button type="submit" className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-coral-600">
                  Unsubscribe
                </button>
              </form>
              <p className="mt-3 text-xs text-slate-ink/60">This applies only to marketing email. You can opt back in anytime by contacting Nonni&rsquo;s.</p>
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
